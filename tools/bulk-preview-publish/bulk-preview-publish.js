import {
  collectPages,
  getJobPollUrl,
  listFolderEntries,
  pollJob,
  resolveJobOutcome,
  startBulkJob,
} from './lib/api.js?v=7';
import {
  getFullscreenAppUrl,
  isLibraryEmbed,
} from './lib/context-mode.js?v=7';
import {
  displayFolderPath,
  displayPath,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js?v=7';
import {
  buildSiteHost,
  buildUrlsForPaths,
} from './lib/urls.js?v=7';

const TOOL_VERSION = '7';

const SDK_URL = 'https://da.live/nx/utils/sdk.js';
const SDK_TIMEOUT_MS = 8000;

/**
 * @typedef {{ kind: 'folder', name: string, folderPath: string }} FolderEntry
 * @typedef {{ kind: 'document', helixPath: string, sourcePath: string, name: string }} DocumentEntry
 * @typedef {FolderEntry | DocumentEntry} BrowseEntry
 */

/** @type {BrowseEntry[]} */
let entries = [];
/** @type {Set<string>} */
const selected = new Set();

/**
 * @typedef {{ helixPath: string, sourcePath: string, name: string }} PageEntry
 */

/** @returns {PageEntry[]} */
function getDocuments() {
  return entries.filter((e) => e.kind === 'document');
}

/**
 * @returns {Promise<{
 *   context: Record<string, string>,
 *   token?: string,
 *   actions: Record<string, unknown>,
 * }>}
 */
async function initSdk() {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('DA SDK not available')), SDK_TIMEOUT_MS);
  });

  try {
    const mod = await import(SDK_URL);
    const sdk = await Promise.race([mod.default, timeout]);
    const { context = {}, token, actions = {} } = sdk;
    return {
      context,
      token,
      actions,
    };
  } catch {
    const params = new URLSearchParams(window.location.search);
    const org = params.get('org') || 'local-org';
    const repo = params.get('repo') || 'local-repo';
    const ref = params.get('ref') || 'main';
    const path = params.get('path') || '';
    return {
      context: {
        org, repo, ref, path,
      },
      actions: { daFetch: fetch },
    };
  }
}

/**
 * @param {Record<string, string>} context
 * @returns {{ org: string, site: string, ref: string, folderPath: string }}
 */
function resolveSiteContext(context) {
  const params = new URLSearchParams(window.location.search);
  const org = context.org || context.owner || '';
  const site = context.repo || context.site || '';
  const ref = context.ref || params.get('ref') || 'main';
  // Default empty (site root). Only honor explicit ?path= — not SDK app route context.
  const folderPath = resolveContentFolderPath(params.get('path') || '');
  return {
    org, site, ref, folderPath,
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {string} folderPath normalized folder path
 * @param {(path: string) => void} onNavigate
 * @returns {HTMLElement}
 */
function buildBreadcrumb(folderPath, onNavigate) {
  const nav = el('nav', 'bulk-pp-breadcrumb');
  nav.setAttribute('aria-label', 'Current folder');

  const rootBtn = el('button', 'bulk-pp-breadcrumb-segment', 'Site root');
  rootBtn.type = 'button';
  rootBtn.addEventListener('click', () => onNavigate(''));
  nav.append(rootBtn);

  const segments = normalizeFolderPath(folderPath).split('/').filter(Boolean);
  segments.forEach((segment, index) => {
    nav.append(el('span', 'bulk-pp-breadcrumb-sep', '/'));
    const path = segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    if (isLast) {
      nav.append(el('span', 'bulk-pp-breadcrumb-current', segment));
    } else {
      const btn = el('button', 'bulk-pp-breadcrumb-segment', segment);
      btn.type = 'button';
      btn.addEventListener('click', () => onNavigate(path));
      nav.append(btn);
    }
  });

  return nav;
}

/**
 * @param {HTMLElement} container
 * @param {string} title
 * @param {string} host
 * @param {string[]} urls
 */
function appendUrlSection(container, title, host, urls) {
  const section = el('div', 'bulk-pp-url-section');
  section.append(el('h3', 'bulk-pp-url-section-title', title));
  section.append(el('p', 'bulk-pp-url-host', host));
  const listWrap = el('div', 'bulk-pp-list-wrap');
  const list = el('ul', 'bulk-pp-url-list');
  if (urls.length === 0) {
    list.append(el('li', null, 'No URLs yet — run the action on selected pages.'));
  } else {
    urls.forEach((url) => {
      const li = el('li');
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = url;
      li.append(link);
      list.append(li);
    });
  }
  listWrap.append(list);
  section.append(listWrap);
  container.append(section);
}

function render(root, state) {
  const {
    org,
    site,
    ref,
    folderPath,
    loading,
    error,
    status,
    statusType,
    jobDetail,
    libraryEmbed,
    fullscreenAppUrl,
    activeTab,
    previewedPaths,
    publishedPaths,
  } = state;

  root.replaceChildren();

  if (libraryEmbed) {
    const banner = el('section', 'bulk-pp-panel bulk-pp-library-banner');
    banner.append(el('h2', null, 'Open from site root or any folder'));
    banner.append(
      el('p', null, 'The Library panel only appears while editing a single document. '
        + 'To bulk preview or publish from the org root or document tree, use the fullscreen Apps entry.'),
    );
    const openBtn = el('button', 'bulk-pp-open-app', 'Open fullscreen app');
    openBtn.type = 'button';
    openBtn.addEventListener('click', () => state.onOpenFullscreen());
    banner.append(openBtn);
    const link = document.createElement('a');
    link.href = fullscreenAppUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'bulk-pp-apps-link';
    link.textContent = 'Or open Apps page';
    banner.append(link);
    root.append(banner);
  }

  const header = el('header', 'bulk-pp-header');
  header.append(
    el('h1', null, 'Bulk Preview & Publish'),
    el('p', null, `Site: ${org} / ${site} · branch: ${ref} · v${TOOL_VERSION}`),
  );
  root.append(header);

  const browse = el('section', 'bulk-pp-panel');
  browse.append(el('h2', null, 'Content path'));
  const row = el('div', 'bulk-pp-row');

  const pathField = el('div', 'bulk-pp-field');
  pathField.append(el('label', null, 'Folder path'));
  const pathInput = document.createElement('input');
  pathInput.type = 'text';
  pathInput.placeholder = 'Leave empty for site root';
  const safeFolder = resolveContentFolderPath(folderPath);
  pathInput.value = displayFolderPath(safeFolder);
  pathInput.autocomplete = 'off';
  pathInput.id = 'bulk-pp-path';
  pathField.append(pathInput);
  row.append(pathField);

  const depthField = el('div', 'bulk-pp-field');
  depthField.append(el('label', null, 'Subfolder depth'));
  const depthSelect = document.createElement('select');
  depthSelect.id = 'bulk-pp-depth';
  [
    ['0', 'This folder only'],
    ['1', '1 level down'],
    ['2', '2 levels down'],
    ['3', '3 levels down'],
    ['-1', 'All subfolders'],
  ].forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === String(state.maxDepth)) opt.selected = true;
    depthSelect.append(opt);
  });
  depthField.append(depthSelect);
  row.append(depthField);

  const loadBtn = el('button', 'bulk-pp-btn bulk-pp-btn-primary', 'Load pages');
  loadBtn.type = 'button';
  loadBtn.disabled = loading;
  row.append(loadBtn);
  browse.append(row);
  root.append(browse);

  const contentPanel = el('section', 'bulk-pp-panel');
  const tabBar = el('div', 'bulk-pp-tabs');
  const pagesTabBtn = el('button', 'bulk-pp-tab', 'Pages');
  const urlsTabBtn = el('button', 'bulk-pp-tab', 'URLs');
  pagesTabBtn.type = 'button';
  urlsTabBtn.type = 'button';
  if (activeTab === 'pages') pagesTabBtn.classList.add('bulk-pp-tab-active');
  else urlsTabBtn.classList.add('bulk-pp-tab-active');
  tabBar.append(pagesTabBtn, urlsTabBtn);
  contentPanel.append(tabBar);

  const pagesPane = el('div', 'bulk-pp-tab-pane');
  if (activeTab === 'pages') pagesPane.classList.add('bulk-pp-tab-pane-active');

  pagesPane.append(buildBreadcrumb(safeFolder, (path) => state.onNavigate(path)));

  const topActions = el('div', 'bulk-pp-actions-top');
  const selectAllBtn = el('button', 'bulk-pp-btn', 'Select all pages');
  const selectNoneBtn = el('button', 'bulk-pp-btn', 'Select none');
  selectAllBtn.type = 'button';
  selectNoneBtn.type = 'button';
  topActions.append(selectAllBtn, selectNoneBtn);
  pagesPane.append(topActions);

  const listWrap = el('div', 'bulk-pp-list-wrap');
  const list = el('ul', 'bulk-pp-list');
  const documents = getDocuments();
  const folderCount = entries.filter((e) => e.kind === 'folder').length;

  if (loading && activeTab === 'pages') {
    list.append(el('li', 'bulk-pp-list-empty', 'Loading…'));
  } else if (error && activeTab === 'pages') {
    list.append(el('li', 'bulk-pp-list-empty', error));
  } else if (entries.length === 0) {
    list.append(el('li', 'bulk-pp-list-empty', 'This folder is empty. Go up or change the path and click Load pages.'));
  } else {
    entries.forEach((entry) => {
      if (entry.kind === 'folder') {
        const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-folder');
        const icon = el('span', 'bulk-pp-item-icon bulk-pp-item-icon-folder', '📁');
        icon.setAttribute('aria-hidden', 'true');
        icon.title = 'Folder';
        const label = el('span', 'bulk-pp-item-label', entry.name);
        const typeTag = el('span', 'bulk-pp-item-type', 'Folder');
        const enterBtn = el('button', 'bulk-pp-enter-folder', '↓');
        enterBtn.type = 'button';
        enterBtn.title = `Open ${entry.name}`;
        enterBtn.setAttribute('aria-label', `Open folder ${entry.name}`);
        enterBtn.addEventListener('click', () => state.onNavigate(entry.folderPath));
        li.append(icon, label, typeTag, enterBtn);
        list.append(li);
        return;
      }

      const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-document');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = entry.helixPath;
      cb.checked = selected.has(entry.helixPath);
      cb.id = `page-${entry.helixPath.replace(/\W/g, '_')}`;
      const icon = el('span', 'bulk-pp-item-icon bulk-pp-item-icon-document', '📄');
      icon.setAttribute('aria-hidden', 'true');
      icon.title = 'Page';
      const label = document.createElement('label');
      label.htmlFor = cb.id;
      label.className = 'bulk-pp-item-label';
      label.textContent = displayPath(entry.helixPath);
      const typeTag = el('span', 'bulk-pp-item-type', 'Page');
      li.append(cb, icon, label, typeTag);
      list.append(li);
    });
  }

  listWrap.append(list);
  pagesPane.append(listWrap);

  const metaParts = [`${selected.size} of ${documents.length} page(s) selected`];
  if (folderCount > 0) {
    metaParts.push(`${folderCount} folder${folderCount === 1 ? '' : 's'} — use ↓ to open`);
  }
  pagesPane.append(el('p', 'bulk-pp-meta', metaParts.join(' · ')));
  contentPanel.append(pagesPane);

  const urlsPane = el('div', 'bulk-pp-tab-pane');
  if (activeTab === 'urls') urlsPane.classList.add('bulk-pp-tab-pane-active');

  const host = buildSiteHost(org, site, ref);
  const previewUrls = buildUrlsForPaths(previewedPaths, org, site, ref, 'preview');
  const liveUrls = buildUrlsForPaths(publishedPaths, org, site, ref, 'live');

  appendUrlSection(
    urlsPane,
    'Preview (.aem.page)',
    host,
    previewUrls,
  );
  appendUrlSection(
    urlsPane,
    'Live (.aem.live)',
    host,
    liveUrls,
  );
  contentPanel.append(urlsPane);
  root.append(contentPanel);

  const runPanel = el('section', 'bulk-pp-panel');
  runPanel.append(el('h2', null, 'Actions'));

  const options = el('div', 'bulk-pp-options');
  const forceLabel = document.createElement('label');
  const forceCb = document.createElement('input');
  forceCb.type = 'checkbox';
  forceCb.id = 'bulk-pp-force';
  forceLabel.append(forceCb, document.createTextNode('Force update (republish even if unchanged)'));
  options.append(forceLabel);
  runPanel.append(options);

  const runRow = el('div', 'bulk-pp-row');
  const previewBtn = el('button', 'bulk-pp-btn bulk-pp-btn-primary', 'Preview selected');
  const publishBtn = el('button', 'bulk-pp-btn bulk-pp-btn-danger', 'Publish selected');
  previewBtn.type = 'button';
  publishBtn.type = 'button';
  previewBtn.disabled = loading || getDocuments().length === 0 || selected.size === 0;
  publishBtn.disabled = loading || getDocuments().length === 0 || selected.size === 0;
  runRow.append(previewBtn, publishBtn);
  runPanel.append(runRow);
  root.append(runPanel);

  if (status) {
    const statusEl = el('div', `bulk-pp-status bulk-pp-status-${statusType || 'info'}`);
    const title = el('strong', null, status);
    statusEl.append(title);
    if (jobDetail) {
      const pre = el('pre', 'bulk-pp-error-detail', jobDetail);
      statusEl.append(pre);
    }
    root.append(statusEl);
  }

  pathInput.addEventListener('change', () => {
    state.folderPath = normalizeFolderPath(pathInput.value.trim());
  });

  loadBtn.addEventListener('click', () => state.onLoad());
  selectAllBtn.addEventListener('click', () => state.onSelectAll(true));
  selectNoneBtn.addEventListener('click', () => state.onSelectAll(false));

  list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const { checked, value } = /** @type {HTMLInputElement} */ (e.target);
      if (checked) selected.add(value);
      else selected.delete(value);
      state.onSelectionChange();
    });
  });

  previewBtn.addEventListener('click', () => state.onRun('preview'));
  publishBtn.addEventListener('click', () => state.onRun('live'));

  pagesTabBtn.addEventListener('click', () => state.onTab('pages'));
  urlsTabBtn.addEventListener('click', () => state.onTab('urls'));
}

async function main() {
  const app = document.getElementById('app');
  if (!app) return;

  const { context, actions } = await initSdk();
  const { daFetch: sdkFetch, setHref } = actions;
  const daFetch = typeof sdkFetch === 'function' ? sdkFetch : fetch;
  const ctx = resolveSiteContext(context);
  ctx.folderPath = resolveContentFolderPath(ctx.folderPath);
  const libraryEmbed = isLibraryEmbed(context);
  const fullscreenAppUrl = getFullscreenAppUrl(
    ctx.org,
    ctx.site,
    ctx.ref,
    ctx.folderPath,
  );

  /** @type {Record<string, unknown>} */
  const state = {
    org: ctx.org,
    site: ctx.site,
    ref: ctx.ref,
    folderPath: ctx.folderPath,
    libraryEmbed,
    fullscreenAppUrl,
    maxDepth: 0,
    loading: false,
    error: null,
    status: null,
    statusType: 'info',
    jobDetail: null,
    activeTab: 'pages',
    previewedPaths: [],
    publishedPaths: [],

    onTab(tab) {
      state.activeTab = tab;
      render(app, state);
    },

    onOpenFullscreen() {
      if (typeof setHref === 'function') {
        setHref(fullscreenAppUrl);
        return;
      }
      window.open(fullscreenAppUrl, '_blank', 'noopener');
    },

    async onNavigate(targetPath) {
      state.folderPath = resolveContentFolderPath(targetPath);
      const pathInput = document.getElementById('bulk-pp-path');
      if (pathInput instanceof HTMLInputElement) {
        pathInput.value = displayFolderPath(state.folderPath);
      }
      await state.onLoad();
    },

    async onLoad() {
      const pathInput = document.getElementById('bulk-pp-path');
      const depthSelect = document.getElementById('bulk-pp-depth');
      const rawPath = pathInput instanceof HTMLInputElement ? pathInput.value : '';
      state.folderPath = resolveContentFolderPath(normalizeFolderPath(rawPath));
      if (pathInput instanceof HTMLInputElement) {
        pathInput.value = displayFolderPath(state.folderPath);
      }
      state.maxDepth = depthSelect instanceof HTMLSelectElement
        ? Number(depthSelect.value)
        : 0;

      if (!state.org || !state.site) {
        state.error = 'Missing org or site in DA context. Open this app from Document Authoring.';
        state.loading = false;
        render(app, state);
        return;
      }

      state.loading = true;
      state.error = null;
      state.status = 'Loading pages…';
      state.statusType = 'info';
      render(app, state);

      try {
        const browseEntries = await listFolderEntries(
          daFetch,
          state.org,
          state.site,
          state.folderPath,
        );

        /** @type {BrowseEntry[]} */
        let merged = [...browseEntries];

        if (state.maxDepth !== 0) {
          const nestedPages = await collectPages(
            daFetch,
            state.org,
            state.site,
            state.folderPath,
            state.maxDepth,
          );
          const existingPaths = new Set(
            merged.filter((e) => e.kind === 'document').map((e) => e.helixPath),
          );
          nestedPages.forEach((page) => {
            if (!existingPaths.has(page.helixPath)) {
              merged.push({ kind: 'document', ...page });
              existingPaths.add(page.helixPath);
            }
          });
          merged.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
            const aKey = a.kind === 'folder' ? a.name : a.helixPath;
            const bKey = b.kind === 'folder' ? b.name : b.helixPath;
            return aKey.localeCompare(bKey);
          });
        }

        entries = merged;
        selected.clear();
        getDocuments().forEach((p) => selected.add(p.helixPath));
        const docCount = getDocuments().length;
        const folders = entries.filter((e) => e.kind === 'folder').length;
        state.error = null;
        if (entries.length === 0) {
          state.status = 'This folder is empty. Try another path or go up a level.';
          state.statusType = 'info';
        } else {
          state.status = `Loaded ${docCount} page(s)${folders ? ` and ${folders} folder(s)` : ''} in ${displayFolderPath(state.folderPath) || 'site root'}.`;
          state.statusType = 'success';
        }
        if (new URLSearchParams(window.location.search).has('debug')) {
          // eslint-disable-next-line no-console
          console.debug('[bulk-pp] entries', entries);
        }
      } catch (err) {
        entries = [];
        selected.clear();
        state.error = err.message || 'Failed to load pages.';
        state.status = null;
      } finally {
        state.loading = false;
        render(app, state);
      }
    },

    onSelectAll(checked) {
      if (checked) getDocuments().forEach((p) => selected.add(p.helixPath));
      else selected.clear();
      state.onSelectionChange();
    },

    onSelectionChange() {
      state.status = `${selected.size} of ${getDocuments().length} page(s) selected.`;
      state.statusType = 'info';
      render(app, state);
    },

    async onRun(topic) {
      const paths = [...selected];
      if (paths.length === 0) return;

      const forceEl = document.getElementById('bulk-pp-force');
      const forceUpdate = forceEl instanceof HTMLInputElement && forceEl.checked;

      if (topic === 'live') {
        // eslint-disable-next-line no-alert -- publish requires explicit author confirmation
        if (!window.confirm(
          `Publish ${paths.length} page(s) to LIVE?\n\nThis updates the production site.`,
        )) return;
      }

      state.loading = true;
      state.status = topic === 'live'
        ? `Starting bulk publish for ${paths.length} page(s)…`
        : `Starting bulk preview for ${paths.length} page(s)…`;
      state.statusType = 'info';
      state.jobDetail = null;
      render(app, state);

      try {
        const bulkResp = await startBulkJob(
          daFetch,
          state.org,
          state.site,
          state.ref,
          topic,
          paths,
          { forceUpdate },
        );

        const jobUrl = getJobPollUrl(bulkResp, state.org, state.site, state.ref, topic);
        if (!jobUrl) {
          state.status = topic === 'live'
            ? `Bulk publish scheduled (${paths.length} paths).`
            : `Bulk preview scheduled (${paths.length} paths).`;
          state.statusType = 'success';
          state.jobDetail = JSON.stringify(bulkResp, null, 2);
          return;
        }

        state.status = 'Job running…';
        const finalJob = await pollJob(daFetch, jobUrl, (job) => {
          const progress = job.progress || job.job?.progress;
          if (progress && typeof progress === 'object') {
            const {
              total, processed, failed,
            } = /** @type {{ total?: number, processed?: number, failed?: number }} */ (
              progress
            );
            state.status = `Job: ${job.state || 'running'} — ${processed ?? 0}/${total ?? '?'} processed (${failed ?? 0} failed)`;
            render(app, state);
          }
        });

        const outcome = resolveJobOutcome(finalJob);
        const action = topic === 'live' ? 'Bulk publish' : 'Bulk preview';
        state.status = `${action} ${outcome.message}`;
        state.statusType = outcome.statusType;
        if (outcome.statusType === 'success') {
          if (topic === 'preview') {
            state.previewedPaths = [...paths];
          } else {
            state.publishedPaths = [...paths];
          }
        }
        const showDetail = outcome.statusType === 'error'
          || new URLSearchParams(window.location.search).has('debug');
        state.jobDetail = showDetail ? JSON.stringify(finalJob, null, 2) : null;
        if (outcome.statusType === 'success') {
          state.activeTab = 'urls';
        }
      } catch (err) {
        state.status = err.message || 'Operation failed.';
        state.statusType = 'error';
        if (err.data) state.jobDetail = JSON.stringify(err.data, null, 2);
      } finally {
        state.loading = false;
        render(app, state);
      }
    },
  };

  if (!ctx.org || !ctx.site) {
    state.error = 'Open from DA (da.live) so org and site are provided, or use ?org=&repo=&ref= for local UI testing.';
    render(app, state);
    return;
  }

  state.status = 'Leave folder path empty for site root, then click Load pages.';
  render(app, state);
  await state.onLoad();
}

main();
