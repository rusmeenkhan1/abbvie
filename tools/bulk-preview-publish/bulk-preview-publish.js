import {
  collectPages,
  getJobPollUrl,
  listFolderEntries,
  pollJob,
  resolveJobOutcome,
  startBulkJob,
} from './lib/api.js?v=11';
import {
  displayFolderPath,
  displayPath,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js?v=11';
import {
  buildSiteHost,
  buildUrlsForPaths,
} from './lib/urls.js?v=11';

const TOOL_VERSION = '11';

const SDK_URL = 'https://da.live/nx/utils/sdk.js';
const SDK_TIMEOUT_MS = 8000;

/**
 * @typedef {{ kind: 'folder', name: string, folderPath: string }} FolderEntry
 * @typedef {{ kind: 'document', helixPath: string, sourcePath: string, name: string }} DocumentEntry
 * @typedef {{ kind: 'data', name: string, sourcePath: string }} DataEntry
 * @typedef {FolderEntry | DocumentEntry | DataEntry} BrowseEntry
 */

/** @type {FolderEntry[]} */
let folders = [];
/** @type {DocumentEntry[]} */
let pages = [];
/** @type {Set<string>} */
const selected = new Set();

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
/**
 * @param {FolderEntry} folder
 * @param {(path: string) => void} onNavigate
 * @returns {HTMLLIElement}
 */
function buildFolderRow(folder, onNavigate) {
  const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-folder');
  const icon = el('span', 'bulk-pp-item-icon bulk-pp-icon-folder', '');
  icon.setAttribute('aria-hidden', 'true');
  const link = el('button', 'bulk-pp-folder-link', folder.name);
  link.type = 'button';
  link.title = `Open ${folder.name}`;
  link.setAttribute('aria-label', `Open folder ${folder.name}`);
  link.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onNavigate(folder.folderPath);
  });
  li.append(icon, link);
  li.addEventListener('click', (e) => {
    if (e.target !== link) link.click();
  });
  return li;
}

/**
 * @param {DocumentEntry} page
 * @param {(checked: boolean, path: string) => void} onToggle
 * @returns {HTMLLIElement}
 */
function buildPageRow(page, onToggle) {
  const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-document');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.value = page.helixPath;
  cb.checked = selected.has(page.helixPath);
  cb.id = `page-${page.helixPath.replace(/\W/g, '_')}`;
  cb.addEventListener('change', (e) => {
    const { checked, value } = /** @type {HTMLInputElement} */ (e.target);
    onToggle(checked, value);
  });
  const icon = el('span', 'bulk-pp-item-icon bulk-pp-icon-document', '');
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('label');
  label.htmlFor = cb.id;
  label.className = 'bulk-pp-item-label';
  label.textContent = page.name;
  label.title = displayPath(page.helixPath);
  li.append(cb, icon, label);
  return li;
}

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
    pageScope,
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
  depthField.append(el('label', null, 'Pages to show'));
  const depthSelect = document.createElement('select');
  depthSelect.id = 'bulk-pp-depth';
  [
    ['folder', 'This folder'],
    ['tree', 'All subfolders'],
  ].forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === pageScope) opt.selected = true;
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

  if (loading && activeTab === 'pages') {
    pagesPane.append(el('p', 'bulk-pp-list-empty', 'Loading…'));
  } else if (error && activeTab === 'pages') {
    pagesPane.append(el('p', 'bulk-pp-list-empty', error));
  } else {
    if (folders.length > 0) {
      pagesPane.append(el('h3', 'bulk-pp-list-heading', 'Folders'));
      const folderWrap = el('div', 'bulk-pp-list-wrap bulk-pp-list-wrap-folders');
      const folderList = el('ul', 'bulk-pp-list');
      folders.forEach((folder) => {
        folderList.append(buildFolderRow(folder, (path) => state.onNavigate(path)));
      });
      folderWrap.append(folderList);
      pagesPane.append(folderWrap);
    }

    pagesPane.append(el('h3', 'bulk-pp-list-heading', 'Pages'));
    const pageWrap = el('div', 'bulk-pp-list-wrap');
    const pageList = el('ul', 'bulk-pp-list');
    if (pages.length === 0) {
      pageList.append(el('li', 'bulk-pp-list-empty', pageScope === 'tree'
        ? 'No pages in this folder tree.'
        : 'No pages in this folder.'));
    } else {
      pages.forEach((page) => {
        pageList.append(buildPageRow(page, (checked, path) => {
          if (checked) selected.add(path);
          else selected.delete(path);
          state.onSelectionChange();
        }));
      });
    }
    pageWrap.append(pageList);
    pagesPane.append(pageWrap);

    const topActions = el('div', 'bulk-pp-actions-top bulk-pp-actions-pages');
    const selectAllBtn = el('button', 'bulk-pp-btn', 'Select all');
    const selectNoneBtn = el('button', 'bulk-pp-btn', 'Select none');
    selectAllBtn.type = 'button';
    selectNoneBtn.type = 'button';
    selectAllBtn.disabled = pages.length === 0;
    topActions.append(selectAllBtn, selectNoneBtn);
    pagesPane.insertBefore(topActions, pageWrap);

    pagesPane.append(
      el('p', 'bulk-pp-meta', `${selected.size} of ${pages.length} page(s) selected`),
    );
  }
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
  previewBtn.disabled = loading || pages.length === 0 || selected.size === 0;
  publishBtn.disabled = loading || pages.length === 0 || selected.size === 0;
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
    if (e.key === 'Enter') state.onLoad(false);
  });
  pathInput.addEventListener('change', () => {
    state.folderPath = normalizeFolderPath(pathInput.value.trim());
  });

  loadBtn.addEventListener('click', () => state.onLoad(false));
  depthSelect.addEventListener('change', () => state.onLoad(false));

  const selectAllEl = pagesPane.querySelector('.bulk-pp-actions-pages .bulk-pp-btn:first-child');
  const selectNoneEl = pagesPane.querySelector('.bulk-pp-actions-pages .bulk-pp-btn:last-child');
  if (selectAllEl) selectAllEl.addEventListener('click', () => state.onSelectAll(true));
  if (selectNoneEl) selectNoneEl.addEventListener('click', () => state.onSelectAll(false));

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
    pageScope: 'folder',
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
      syncUrlPath(state.ref, state.folderPath);
      await state.onLoad(true);
    },

    /**
     * @param {boolean} [fromFolderNav] skip reading scope from DOM when drilling into a folder
     */
    async onLoad(fromFolderNav = false) {
      if (!fromFolderNav) {
        const pathInput = document.getElementById('bulk-pp-path');
        const depthSelect = document.getElementById('bulk-pp-depth');
        const rawPath = pathInput instanceof HTMLInputElement ? pathInput.value : '';
        state.folderPath = resolveContentFolderPath(normalizeFolderPath(rawPath));
        if (depthSelect instanceof HTMLSelectElement) {
          state.pageScope = depthSelect.value === 'tree' ? 'tree' : 'folder';
        }
      }
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
        const browseEntries = await listFolderEntries(
          daFetch,
          state.org,
          state.site,
          state.folderPath,
        );

        folders = browseEntries.filter((e) => e.kind === 'folder');

        if (state.pageScope === 'tree') {
          const nestedPages = await collectPages(
            daFetch,
            state.org,
            state.site,
            state.folderPath,
            -1,
          );
          pages = nestedPages.map((page) => ({
            kind: 'document',
            name: page.name,
            sourcePath: page.sourcePath,
            helixPath: page.helixPath,
          }));
        } else {
          pages = browseEntries.filter((e) => e.kind === 'document');
        }

        const prevSelected = new Set(selected);
        selected.clear();
        pages.forEach((p) => {
          if (prevSelected.has(p.helixPath)) selected.add(p.helixPath);
        });
        if (selected.size === 0) {
          pages.forEach((p) => selected.add(p.helixPath));
        }

        const docCount = pages.length;
        const location = displayFolderPath(state.folderPath) || 'site root';
        state.error = null;

        if (folders.length === 0 && docCount === 0) {
          state.status = `No folders or pages in ${location}.`;
          state.statusType = 'info';
        } else if (state.pageScope === 'tree') {
          state.status = `${docCount} page(s) under ${location} (all subfolders).`;
          state.statusType = 'success';
        } else {
          state.status = `${docCount} page(s) and ${folders.length} folder(s) in ${location}.`;
          state.statusType = 'success';
        }

        if (new URLSearchParams(window.location.search).has('debug')) {
          // eslint-disable-next-line no-console
          console.debug('[bulk-pp] folders', folders, 'pages', pages);
        }
      } catch (err) {
        folders = [];
        pages = [];
        selected.clear();
        state.error = err.message || 'Failed to load content.';
        state.status = null;
      } finally {
        state.loading = false;
        render(app, state);
      }
    },

    onSelectAll(checked) {
      if (checked) pages.forEach((p) => selected.add(p.helixPath));
      else selected.clear();
      state.onSelectionChange();
    },

    onSelectionChange() {
      const meta = document.querySelector('.bulk-pp-meta');
      if (meta) meta.textContent = `${selected.size} of ${pages.length} page(s) selected`;
      const previewBtn = document.querySelector('.bulk-pp-btn-primary');
      const publishBtn = document.querySelector('.bulk-pp-btn-danger');
      const disabled = pages.length === 0 || selected.size === 0;
      if (previewBtn instanceof HTMLButtonElement) previewBtn.disabled = disabled;
      if (publishBtn instanceof HTMLButtonElement) publishBtn.disabled = disabled;
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
