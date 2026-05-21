import {
  collectPages,
  getJobPollUrl,
  listFolderEntries,
  pollJob,
  resolveJobOutcome,
  startBulkJob,
} from './lib/api.js?v=10';
import {
  displayFolderPath,
  displayPath,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js?v=10';
import {
  buildSiteHost,
  buildUrlsForPaths,
} from './lib/urls.js?v=10';

const TOOL_VERSION = '10';

const SDK_URL = 'https://da.live/nx/utils/sdk.js';
const SDK_TIMEOUT_MS = 8000;

/**
 * @typedef {{ kind: 'folder', name: string, folderPath: string }} FolderEntry
 * @typedef {{ kind: 'document', helixPath: string, sourcePath: string, name: string }} DocumentEntry
 * @typedef {{ kind: 'data', name: string, sourcePath: string }} DataEntry
 * @typedef {FolderEntry | DocumentEntry | DataEntry} BrowseEntry
 */

/** @type {BrowseEntry[]} */
let entries = [];
/** @type {Set<string>} */
const selected = new Set();

/** @returns {DocumentEntry[]} */
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
    return { context, token, actions };
  } catch {
    const params = new URLSearchParams(window.location.search);
    return {
      context: {
        org: params.get('org') || 'local-org',
        repo: params.get('repo') || 'local-repo',
        ref: params.get('ref') || 'main',
        path: params.get('path') || '',
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
  const folderPath = resolveContentFolderPath(
    params.get('path') || context.path || '',
  );
  return { org, site, ref, folderPath };
}

/**
 * @param {string} ref
 * @param {string} folderPath
 */
function syncUrlPath(ref, folderPath) {
  const params = new URLSearchParams(window.location.search);
  if (ref && ref !== 'main') params.set('ref', ref);
  else params.delete('ref');
  const normalized = normalizeFolderPath(folderPath);
  if (normalized) params.set('path', normalized);
  else params.delete('path');
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * DA-style breadcrumb: Site root › dir1 › dir2
 * @param {string} folderPath
 * @param {(path: string) => void} onNavigate
 * @returns {HTMLElement}
 */
function buildBreadcrumb(folderPath, onNavigate) {
  const nav = el('nav', 'bulk-pp-breadcrumb');
  nav.setAttribute('aria-label', 'Folder path');

  const rootBtn = el('button', 'bulk-pp-breadcrumb-segment', 'Site root');
  rootBtn.type = 'button';
  rootBtn.addEventListener('click', () => onNavigate(''));
  nav.append(rootBtn);

  const segments = normalizeFolderPath(folderPath).split('/').filter(Boolean);
  segments.forEach((segment, index) => {
    nav.append(el('span', 'bulk-pp-breadcrumb-sep', '›'));
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
    activeTab,
    previewedPaths,
    publishedPaths,
    includeSubfolders,
  } = state;

  root.replaceChildren();

  const header = el('header', 'bulk-pp-header');
  header.append(
    el('h1', null, 'Bulk Preview & Publish'),
    el('p', 'bulk-pp-subtitle', `${org} / ${site} · ${ref}`),
  );
  root.append(header);

  const browse = el('section', 'bulk-pp-panel');
  browse.append(el('h2', null, 'Browse'));
  const row = el('div', 'bulk-pp-row');

  const pathField = el('div', 'bulk-pp-field');
  pathField.append(el('label', null, 'Jump to path'));
  const pathInput = document.createElement('input');
  pathInput.type = 'text';
  pathInput.placeholder = '/who-we-are or leave empty for site root';
  const safeFolder = resolveContentFolderPath(folderPath);
  pathInput.value = displayFolderPath(safeFolder);
  pathInput.autocomplete = 'off';
  pathInput.id = 'bulk-pp-path';
  pathField.append(pathInput);
  row.append(pathField);

  const depthField = el('div', 'bulk-pp-field bulk-pp-field-narrow');
  depthField.append(el('label', null, 'Include subfolders'));
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

  const loadBtn = el('button', 'bulk-pp-btn bulk-pp-btn-primary', 'Refresh');
  loadBtn.type = 'button';
  loadBtn.disabled = loading;
  row.append(loadBtn);
  browse.append(row);
  root.append(browse);

  const contentPanel = el('section', 'bulk-pp-panel bulk-pp-panel-content');
  const tabBar = el('div', 'bulk-pp-tabs');
  const pagesTabBtn = el('button', 'bulk-pp-tab', 'Content');
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

  if (includeSubfolders) {
    pagesPane.append(
      el('p', 'bulk-pp-hint', 'Showing pages from this folder and subfolders. Use breadcrumbs to move between folders.'),
    );
  }

  const topActions = el('div', 'bulk-pp-actions-top');
  const selectAllBtn = el('button', 'bulk-pp-btn', 'Select all');
  const selectNoneBtn = el('button', 'bulk-pp-btn', 'Select none');
  selectAllBtn.type = 'button';
  selectNoneBtn.type = 'button';
  selectAllBtn.disabled = getDocuments().length === 0;
  topActions.append(selectAllBtn, selectNoneBtn);
  pagesPane.append(topActions);

  const listWrap = el('div', 'bulk-pp-list-wrap');
  const list = el('ul', 'bulk-pp-list');
  const documents = getDocuments();

  if (loading && activeTab === 'pages') {
    list.append(el('li', 'bulk-pp-list-empty', 'Loading…'));
  } else if (error && activeTab === 'pages') {
    list.append(el('li', 'bulk-pp-list-empty', error));
  } else if (entries.length === 0) {
    list.append(el('li', 'bulk-pp-list-empty', 'Nothing here. Go up via breadcrumbs or change the path.'));
  } else {
    entries.forEach((entry) => {
      if (entry.kind === 'folder') {
        const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-folder');
        const icon = el('span', 'bulk-pp-item-icon', '');
        icon.setAttribute('aria-hidden', 'true');
        icon.classList.add('bulk-pp-icon-folder');
        const link = el('button', 'bulk-pp-folder-link', entry.name);
        link.type = 'button';
        link.title = `Open ${entry.name}`;
        link.setAttribute('aria-label', `Open folder ${entry.name}`);
        link.addEventListener('click', () => state.onNavigate(entry.folderPath));
        li.append(icon, link);
        li.addEventListener('click', (e) => {
          if (e.target === li || e.target === icon) link.click();
        });
        list.append(li);
        return;
      }

      if (entry.kind === 'data') {
        const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-data');
        const icon = el('span', 'bulk-pp-item-icon bulk-pp-icon-data', '');
        icon.setAttribute('aria-hidden', 'true');
        const label = el('span', 'bulk-pp-item-label', entry.name);
        label.title = 'Site config (not published as a page)';
        li.append(icon, label);
        list.append(li);
        return;
      }

      const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-document');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = entry.helixPath;
      cb.checked = selected.has(entry.helixPath);
      cb.id = `page-${entry.helixPath.replace(/\W/g, '_')}`;
      const icon = el('span', 'bulk-pp-item-icon bulk-pp-icon-document', '');
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('label');
      label.htmlFor = cb.id;
      label.className = 'bulk-pp-item-label';
      label.textContent = entry.name;
      label.title = displayPath(entry.helixPath);
      li.append(cb, icon, label);
      list.append(li);
    });
  }

  listWrap.append(list);
  pagesPane.append(listWrap);
  pagesPane.append(
    el('p', 'bulk-pp-meta', `${selected.size} of ${documents.length} page(s) selected`),
  );
  contentPanel.append(pagesPane);

  const urlsPane = el('div', 'bulk-pp-tab-pane');
  if (activeTab === 'urls') urlsPane.classList.add('bulk-pp-tab-pane-active');

  const host = buildSiteHost(org, site, ref);
  appendUrlSection(urlsPane, 'Preview (.aem.page)', host, buildUrlsForPaths(previewedPaths, org, site, ref, 'preview'));
  appendUrlSection(urlsPane, 'Live (.aem.live)', host, buildUrlsForPaths(publishedPaths, org, site, ref, 'live'));
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
  previewBtn.disabled = loading || documents.length === 0 || selected.size === 0;
  publishBtn.disabled = loading || documents.length === 0 || selected.size === 0;
  runRow.append(previewBtn, publishBtn);
  runPanel.append(runRow);
  root.append(runPanel);

  if (status) {
    const statusEl = el('div', `bulk-pp-status bulk-pp-status-${statusType || 'info'}`);
    statusEl.append(el('strong', null, status));
    if (jobDetail) statusEl.append(el('pre', 'bulk-pp-error-detail', jobDetail));
    root.append(statusEl);
  }

  pathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') state.onLoad();
  });
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
  const daFetch = typeof actions.daFetch === 'function' ? actions.daFetch : fetch;
  const ctx = resolveSiteContext(context);
  ctx.folderPath = resolveContentFolderPath(ctx.folderPath);

  /** @type {Record<string, unknown>} */
  const state = {
    org: ctx.org,
    site: ctx.site,
    ref: ctx.ref,
    folderPath: ctx.folderPath,
    maxDepth: 0,
    includeSubfolders: false,
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

    async onNavigate(targetPath) {
      state.folderPath = resolveContentFolderPath(targetPath);
      state.maxDepth = 0;
      state.includeSubfolders = false;
      syncUrlPath(state.ref, state.folderPath);
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
      state.includeSubfolders = state.maxDepth !== 0;
      syncUrlPath(state.ref, state.folderPath);

      if (!state.org || !state.site) {
        state.error = 'Missing org or site in DA context. Open this app from Document Authoring.';
        state.loading = false;
        render(app, state);
        return;
      }

      state.loading = true;
      state.error = null;
      state.status = 'Loading…';
      state.statusType = 'info';
      render(app, state);

      try {
        if (state.includeSubfolders) {
          const nestedPages = await collectPages(
            daFetch,
            state.org,
            state.site,
            state.folderPath,
            state.maxDepth,
          );
          entries = nestedPages.map((page) => ({
            kind: 'document',
            name: page.name,
            sourcePath: page.sourcePath,
            helixPath: page.helixPath,
          }));
        } else {
          entries = await listFolderEntries(
            daFetch,
            state.org,
            state.site,
            state.folderPath,
          );
        }

        selected.clear();
        getDocuments().forEach((p) => selected.add(p.helixPath));

        const docCount = getDocuments().length;
        const location = displayFolderPath(state.folderPath) || 'site root';
        state.error = null;

        if (entries.length === 0) {
          state.status = `No content in ${location}.`;
          state.statusType = 'info';
        } else if (state.includeSubfolders) {
          state.status = `Found ${docCount} page(s) under ${location} (including subfolders).`;
          state.statusType = 'success';
        } else {
          const folders = entries.filter((e) => e.kind === 'folder').length;
          const parts = [`${docCount} page(s)`];
          if (folders) parts.push(`${folders} folder(s)`);
          state.status = `Loaded ${parts.join(', ')} in ${location}.`;
          state.statusType = 'success';
        }

        if (new URLSearchParams(window.location.search).has('debug')) {
          // eslint-disable-next-line no-console
          console.debug('[bulk-pp] entries', entries);
        }
      } catch (err) {
        entries = [];
        selected.clear();
        state.error = err.message || 'Failed to load content.';
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
            } = /** @type {{ total?: number, processed?: number, failed?: number }} */ (progress);
            state.status = `Job: ${job.state || 'running'} — ${processed ?? 0}/${total ?? '?'} processed (${failed ?? 0} failed)`;
            render(app, state);
          }
        });

        const outcome = resolveJobOutcome(finalJob);
        const action = topic === 'live' ? 'Bulk publish' : 'Bulk preview';
        state.status = `${action} ${outcome.message}`;
        state.statusType = outcome.statusType;
        if (outcome.statusType === 'success') {
          if (topic === 'preview') state.previewedPaths = [...paths];
          else state.publishedPaths = [...paths];
          state.activeTab = 'urls';
        }
        const showDetail = outcome.statusType === 'error'
          || new URLSearchParams(window.location.search).has('debug');
        state.jobDetail = showDetail ? JSON.stringify(finalJob, null, 2) : null;
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
    state.error = 'Open from DA (da.live) so org and site are provided, or use ?org=&repo=&ref= for local testing.';
    render(app, state);
    return;
  }

  await state.onLoad();
}

main();
