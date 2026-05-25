import {
  collectPages,
  fetchPlatformStatusForPaths,
  getJobPollUrl,
  listFolderEntries,
  pollJob,
  resolveJobOutcome,
  startBulkJob,
} from './lib/api.js?v=17';
import {
  displayFolderPath,
  displayPath,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js?v=17';
import {
  buildSiteHost,
  buildUrlsForPaths,
} from './lib/urls.js?v=17';
import {
  filterAndSortPages,
  formatStatusDate,
  getPageStatus,
  loadHistory,
  mergeStatusEntries,
  PAGE_FILTERS,
  recordPaths,
  saveHistory,
  statusLabel,
} from './lib/page-history.js?v=17';

const TOOL_VERSION = '17';

/** @type {Record<'untouched'|'previewed'|'published', { bg: string, border: string, badgeBg: string, badgeColor: string }>} */
const STATUS_THEME = {
  untouched: { bg: '#fde8e8', border: '#c9252d', badgeBg: '#fde8e8', badgeColor: '#8b1a1a' },
  previewed: { bg: '#fff3cd', border: '#c9940a', badgeBg: '#fff3cd', badgeColor: '#7a5a00' },
  published: { bg: '#d4edda', border: '#2d8a4e', badgeBg: '#d4edda', badgeColor: '#1a5c32' },
};

let runtimeStylesReady = false;

function ensureRuntimeStyles() {
  if (runtimeStylesReady || document.getElementById('bulk-pp-runtime-styles')) {
    runtimeStylesReady = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'bulk-pp-runtime-styles';
  style.textContent = `
    .bulk-pp-filter-row{display:flex!important;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 16px;padding:14px 16px;background:#f0f4fa;border:1px solid #c8d0e0;border-radius:8px}
    .bulk-pp-status-legend{display:flex!important;flex-wrap:wrap;gap:12px 20px;flex:1}
    .bulk-pp-legend-item{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:#5c6578}
    .bulk-pp-legend-dot{width:12px;height:12px;border-radius:3px;flex-shrink:0}
    .bulk-pp-field-filter{flex:0 1 280px;min-width:200px}
    .bulk-pp-row-untouched{background:#fde8e8!important;border-left:4px solid #c9252d!important}
    .bulk-pp-row-previewed{background:#fff3cd!important;border-left:4px solid #c9940a!important}
    .bulk-pp-row-published{background:#d4edda!important;border-left:4px solid #2d8a4e!important}
    .bulk-pp-status-badge{display:inline-flex;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .bulk-pp-status-badge-untouched{background:#fde8e8;color:#8b1a1a}
    .bulk-pp-status-badge-previewed{background:#fff3cd;color:#7a5a00}
    .bulk-pp-status-badge-published{background:#d4edda;color:#1a5c32}
    .bulk-pp-item-main{flex:1;min-width:0}
    .bulk-pp-item-dates{display:block;font-size:12px;color:#8a94a8;margin-top:2px}
  `;
  document.head.appendChild(style);
  runtimeStylesReady = true;
}

/**
 * @param {HTMLLIElement} li
 * @param {'untouched'|'previewed'|'published'} status
 */
function applyRowStatusStyle(li, status) {
  const theme = STATUS_THEME[status];
  li.style.background = theme.bg;
  li.style.borderLeft = `4px solid ${theme.border}`;
}

/**
 * @param {HTMLElement} badge
 * @param {'untouched'|'previewed'|'published'} status
 */
function applyBadgeStyle(badge, status) {
  const theme = STATUS_THEME[status];
  badge.style.background = theme.badgeBg;
  badge.style.color = theme.badgeColor;
}

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
 * @param {string} title
 * @param {string} [extraClass]
 * @returns {{ panel: HTMLElement, body: HTMLElement }}
 */
function createPanel(title, extraClass = '') {
  const panel = el('section', `bulk-pp-panel ${extraClass}`.trim());
  const head = el('div', 'bulk-pp-panel-head');
  head.append(el('h2', null, title));
  const body = el('div', 'bulk-pp-panel-body');
  panel.append(head, body);
  return { panel, body };
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
 * @param {import('./lib/page-history.js?v=15').PageHistoryEntry | undefined} entry
 * @param {(checked: boolean, path: string) => void} onToggle
 * @returns {HTMLLIElement}
 */
function buildPageRow(page, entry, onToggle) {
  const status = getPageStatus(entry);
  const li = el('li', `bulk-pp-list-item bulk-pp-list-item-document bulk-pp-row-${status}`);
  li.dataset.status = status;

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'bulk-pp-page-cb';
  cb.value = page.helixPath;
  cb.dataset.path = page.helixPath;
  cb.checked = selected.has(page.helixPath);
  cb.id = `page-${page.helixPath.replace(/\W/g, '_')}`;
  cb.addEventListener('change', (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const path = input.dataset.path || input.value;
    onToggle(input.checked, path);
  });

  const icon = el('span', 'bulk-pp-item-icon bulk-pp-icon-document', '');
  icon.setAttribute('aria-hidden', 'true');

  const labelWrap = el('div', 'bulk-pp-item-main');
  const label = document.createElement('label');
  label.htmlFor = cb.id;
  label.className = 'bulk-pp-item-label';
  label.textContent = page.name;
  label.title = displayPath(page.helixPath);
  labelWrap.append(label);

  const dateParts = [];
  if (entry?.previewedAt) dateParts.push(`Preview: ${formatStatusDate(entry.previewedAt)}`);
  if (entry?.publishedAt) dateParts.push(`Live: ${formatStatusDate(entry.publishedAt)}`);
  if (dateParts.length) labelWrap.append(el('span', 'bulk-pp-item-dates', dateParts.join(' · ')));

  const badge = el('span', `bulk-pp-status-badge bulk-pp-status-badge-${status}`, statusLabel(status));
  applyRowStatusStyle(li, status);
  applyBadgeStyle(badge, status);
  li.append(cb, icon, labelWrap, badge);
  return li;
}

/**
 * @param {Record<string, unknown>} state
 * @returns {Record<string, import('./lib/page-history.js').PageHistoryEntry>}
 */
function buildStatusMap(state) {
  /** @type {Record<string, import('./lib/page-history.js').PageHistoryEntry>} */
  const map = {};
  const platform = /** @type {Record<string, import('./lib/page-history.js').PageHistoryEntry>} */ (
    state.platformStatus || {}
  );
  const local = /** @type {Record<string, import('./lib/page-history.js').PageHistoryEntry>} */ (
    state.pageHistory || {}
  );
  pages.forEach((page) => {
    map[page.helixPath] = mergeStatusEntries(
      platform[page.helixPath],
      local[page.helixPath],
    );
  });
  return map;
}

/**
 * @param {Record<string, unknown>} state
 * @returns {DocumentEntry[]}
 */
function getVisiblePages(state) {
  return filterAndSortPages(
    pages,
    buildStatusMap(state),
    String(state.pageFilter || 'all'),
  );
}

/**
 * @param {Record<string, unknown>} state
 */
function buildStatusLegend() {
  const legend = el('div', 'bulk-pp-status-legend');
  legend.setAttribute('aria-label', 'Page status colors');
  [
    ['untouched', 'Not on preview or live', STATUS_THEME.untouched.border],
    ['previewed', 'On preview only (.aem.page)', STATUS_THEME.previewed.border],
    ['published', 'On live (.aem.live)', STATUS_THEME.published.border],
  ].forEach(([key, text, color]) => {
    const item = el('span', `bulk-pp-legend-item bulk-pp-legend-${key}`);
    const dot = el('span', 'bulk-pp-legend-dot');
    dot.style.background = color;
    item.append(dot, document.createTextNode(text));
    legend.append(item);
  });
  return legend;
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
    pageFilter,
    pageHistory,
    platformStatus,
    statusCheckFailed,
  } = state;

  const statusMap = buildStatusMap(state);
  const visiblePages = getVisiblePages(state);

  ensureRuntimeStyles();
  root.replaceChildren();

  const header = el('header', 'bulk-pp-header');
  const headerInner = el('div', 'bulk-pp-header-inner');
  const headerBrand = el('div', 'bulk-pp-header-brand');
  headerBrand.append(
    el('span', 'bulk-pp-header-eyebrow', 'Document Authoring'),
    el('h1', null, 'Bulk Preview & Publish'),
    el('p', 'bulk-pp-header-desc', 'Select pages, preview on AEM, and publish to production in a single workflow.'),
  );
  const headerMeta = el('div', 'bulk-pp-header-meta');
  headerMeta.append(
    el('span', 'bulk-pp-badge', org),
    el('span', 'bulk-pp-badge bulk-pp-badge-muted', site),
    el('span', 'bulk-pp-badge bulk-pp-badge-muted', ref),
  );
  headerInner.append(headerBrand, headerMeta);
  header.append(headerInner);
  root.append(header);

  const { panel: browse, body: browseBody } = createPanel('Location & scope');
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
  browseBody.append(row);
  root.append(browse);

  const contentPanel = el('section', 'bulk-pp-panel bulk-pp-panel-content');
  const contentHead = el('div', 'bulk-pp-panel-head');
  contentHead.append(el('h2', null, 'Content & URLs'));
  contentPanel.append(contentHead);
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
    const filterRow = el('div', 'bulk-pp-filter-row');
    filterRow.style.display = 'flex';
    filterRow.style.flexWrap = 'wrap';
    filterRow.style.marginBottom = '16px';
    filterRow.append(buildStatusLegend());
    const filterField = el('div', 'bulk-pp-field bulk-pp-field-filter');
    filterField.append(el('label', null, 'Filter pages'));
    const filterSelect = document.createElement('select');
    filterSelect.id = 'bulk-pp-page-filter';
    PAGE_FILTERS.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === (pageFilter || 'all')) opt.selected = true;
      filterSelect.append(opt);
    });
    filterField.append(filterSelect);
    filterRow.append(filterField);
    pagesPane.append(filterRow);

    const statusNote = el('p', 'bulk-pp-status-note', statusCheckFailed
      ? 'Could not load AEM preview/live status — showing local tool history only.'
      : 'Status from AEM Admin API (preview & live deployment).');
    pagesPane.append(statusNote);

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

    const toolbar = el('div', 'bulk-pp-toolbar');
    const toolbarActions = el('div', 'bulk-pp-toolbar-actions');
    const selectAllBtn = el('button', 'bulk-pp-btn bulk-pp-btn-ghost', 'Select all');
    const selectNoneBtn = el('button', 'bulk-pp-btn bulk-pp-btn-ghost', 'Select none');
    selectAllBtn.type = 'button';
    selectNoneBtn.type = 'button';
    selectAllBtn.disabled = visiblePages.length === 0;
    selectNoneBtn.disabled = visiblePages.length === 0;
    selectAllBtn.addEventListener('click', () => state.onSelectAll(true));
    selectNoneBtn.addEventListener('click', () => state.onSelectAll(false));
    toolbarActions.append(selectAllBtn, selectNoneBtn);
    const visibleCount = visiblePages.length;
    const totalCount = pages.length;
    const pillText = visibleCount === totalCount
      ? `${selected.size} of ${totalCount} selected`
      : `${selected.size} selected · ${visibleCount} shown (${totalCount} total)`;
    const selectionPill = el('span', 'bulk-pp-selection-pill', pillText);
    selectionPill.id = 'bulk-pp-selection-pill';
    toolbar.append(toolbarActions, selectionPill);

    const pageWrap = el('div', 'bulk-pp-list-wrap');
    const pageList = el('ul', 'bulk-pp-list');
    pageList.id = 'bulk-pp-page-list';
    if (pages.length === 0) {
      pageList.append(el('li', 'bulk-pp-list-empty', pageScope === 'tree'
        ? 'No pages in this folder tree.'
        : 'No pages in this folder.'));
    } else if (visiblePages.length === 0) {
      pageList.append(el('li', 'bulk-pp-list-empty', 'No pages match this filter.'));
    } else {
      visiblePages.forEach((page) => {
        pageList.append(buildPageRow(
          page,
          statusMap[page.helixPath],
          (checked, path) => {
            if (checked) selected.add(path);
            else selected.delete(path);
            state.onSelectionChange();
          },
        ));
      });
    }
    pageWrap.append(pageList);
    pagesPane.append(toolbar, pageWrap);

    filterSelect.addEventListener('change', () => {
      state.pageFilter = filterSelect.value;
      render(root, state);
    });
  }
  contentPanel.append(pagesPane);

  const urlsPane = el('div', 'bulk-pp-tab-pane');
  if (activeTab === 'urls') urlsPane.classList.add('bulk-pp-tab-pane-active');

  const host = buildSiteHost(org, site, ref);
  appendUrlSection(urlsPane, 'Preview (.aem.page)', host, buildUrlsForPaths(previewedPaths, org, site, ref, 'preview'));
  appendUrlSection(urlsPane, 'Live (.aem.live)', host, buildUrlsForPaths(publishedPaths, org, site, ref, 'live'));
  contentPanel.append(urlsPane);
  root.append(contentPanel);

  const { panel: runPanel, body: runBody } = createPanel('Run bulk actions', 'bulk-pp-actions-panel');
  const options = el('div', 'bulk-pp-options');
  const forceLabel = document.createElement('label');
  const forceCb = document.createElement('input');
  forceCb.type = 'checkbox';
  forceCb.id = 'bulk-pp-force';
  forceLabel.append(forceCb, document.createTextNode('Force update (republish even if unchanged)'));
  options.append(forceLabel);
  runBody.append(options);

  const runRow = el('div', 'bulk-pp-run-actions');
  const previewBtn = el('button', 'bulk-pp-btn bulk-pp-btn-primary', 'Preview selected');
  const publishBtn = el('button', 'bulk-pp-btn bulk-pp-btn-danger', 'Publish to live');
  previewBtn.type = 'button';
  publishBtn.type = 'button';
  previewBtn.id = 'bulk-pp-preview-btn';
  publishBtn.id = 'bulk-pp-publish-btn';
  previewBtn.disabled = loading || pages.length === 0 || selected.size === 0;
  publishBtn.disabled = loading || pages.length === 0 || selected.size === 0;
  runRow.append(previewBtn, publishBtn);
  runBody.append(runRow);
  root.append(runPanel);

  if (status) {
    const statusEl = el('div', `bulk-pp-status bulk-pp-status-${statusType || 'info'}`);
    statusEl.append(el('strong', null, status));
    if (jobDetail) statusEl.append(el('pre', 'bulk-pp-error-detail', jobDetail));
    root.append(statusEl);
  }

  const versionNote = el('p', 'bulk-pp-version', `Bulk Preview & Publish · v${TOOL_VERSION}`);
  versionNote.style.cssText = 'margin-top:20px;font-size:12px;color:#8a94a8;text-align:center';
  root.append(versionNote);

  pathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') state.onLoad(false);
  });
  pathInput.addEventListener('change', () => {
    state.folderPath = normalizeFolderPath(pathInput.value.trim());
  });

  loadBtn.addEventListener('click', () => state.onLoad(false));
  depthSelect.addEventListener('change', () => state.onLoad(false));

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
    root: app,
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
    pageFilter: 'all',
    pageHistory: loadHistory(ctx.org, ctx.site, ctx.ref),
    platformStatus: {},
    statusCheckFailed: false,

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

        state.status = 'Checking preview & live status on AEM…';
        state.statusType = 'info';
        render(app, state);

        try {
          state.platformStatus = await fetchPlatformStatusForPaths(
            daFetch,
            state.org,
            state.site,
            state.ref,
            pages.map((p) => p.helixPath),
          );
          state.statusCheckFailed = false;
        } catch (statusErr) {
          state.platformStatus = {};
          state.statusCheckFailed = true;
          if (new URLSearchParams(window.location.search).has('debug')) {
            // eslint-disable-next-line no-console
            console.warn('[bulk-pp] platform status failed', statusErr);
          }
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
      const visible = getVisiblePages(state);
      if (checked) {
        visible.forEach((p) => selected.add(p.helixPath));
      } else {
        visible.forEach((p) => selected.delete(p.helixPath));
      }
      render(/** @type {HTMLElement} */ (state.root), state);
    },

    onSelectionChange() {
      const root = /** @type {HTMLElement | null} */ (state.root);
      if (!root) return;

      const visible = getVisiblePages(state);
      const pill = root.querySelector('#bulk-pp-selection-pill');
      if (pill) {
        const visibleCount = visible.length;
        const totalCount = pages.length;
        pill.textContent = visibleCount === totalCount
          ? `${selected.size} of ${totalCount} selected`
          : `${selected.size} selected · ${visibleCount} shown (${totalCount} total)`;
      }

      root.querySelectorAll('.bulk-pp-page-cb').forEach((cb) => {
        if (!(cb instanceof HTMLInputElement)) return;
        const path = cb.dataset.path || cb.value;
        const isSelected = selected.has(path);
        if (cb.checked !== isSelected) cb.checked = isSelected;
      });

      const disabled = pages.length === 0 || selected.size === 0;
      const previewBtn = root.querySelector('#bulk-pp-preview-btn');
      const publishBtn = root.querySelector('#bulk-pp-publish-btn');
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
          const historyType = topic === 'live' ? 'live' : 'preview';
          state.pageHistory = recordPaths(
            /** @type {Record<string, import('./lib/page-history.js?v=15').PageHistoryEntry>} */ (
              state.pageHistory
            ),
            paths,
            historyType,
          );
          saveHistory(state.org, state.site, state.ref, state.pageHistory);
          if (topic === 'preview') state.previewedPaths = [...paths];
          else state.publishedPaths = [...paths];
          state.status = topic === 'live'
            ? `Bulk publish scheduled (${paths.length} paths).`
            : `Bulk preview scheduled (${paths.length} paths).`;
          state.statusType = 'success';
          state.jobDetail = JSON.stringify(bulkResp, null, 2);
          state.activeTab = 'urls';
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
          const historyType = topic === 'live' ? 'live' : 'preview';
          state.pageHistory = recordPaths(
            /** @type {Record<string, import('./lib/page-history.js?v=15').PageHistoryEntry>} */ (
              state.pageHistory
            ),
            paths,
            historyType,
          );
          saveHistory(state.org, state.site, state.ref, state.pageHistory);
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
