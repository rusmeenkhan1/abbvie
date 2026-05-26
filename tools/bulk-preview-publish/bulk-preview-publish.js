import {
  collectPages,
  configureAdminApi,
  describeAdminEndpoints,
  fetchPlatformStatusForPaths,
  isHardcodeIndexTest,
  wrapDaFetch,
  formatAdminApiError,
  getJobPollUrl,
  listFolderEntries,
  pollJob,
  resolveJobOutcome,
  startBulkJob,
} from './lib/api.js?v=42';
import {
  displayFolderPath,
  formatPageListLabel,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js?v=42';
import {
  buildDaEditUrl,
  buildSiteHost,
  buildUrlsForPaths,
} from './lib/urls.js?v=42';
import {
  filterAndSortPages,
  formatStatusDate,
  getPageStatus,
  PAGE_FILTERS,
  pathsOnPreview,
  pathsOnPublished,
  countStatusBreakdown,
  statusLabel,
} from './lib/page-history.js?v=42';

const TOOL_VERSION = '42';

function ensureLatestToolCache() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('v') === TOOL_VERSION) return;
  params.set('v', TOOL_VERSION);
  const next = new URL(window.location.href);
  next.search = params.toString();
  window.location.replace(next.toString());
}

/**
 * @param {Record<string, { previewedAt?: number, publishedAt?: number }>} platformStatus
 * @param {DocumentEntry[]} pageList
 */
function countDeployedPages(platformStatus, pageList) {
  return pageList.filter((p) => {
    const e = platformStatus[p.helixPath];
    return Boolean(e?.previewedAt || e?.publishedAt);
  }).length;
}

/**
 * @param {Record<string, { previewedAt?: number, publishedAt?: number }>} platformStatus
 * @param {{ helixPath: string }[]} pageList
 * @returns {string}
 */
function formatStatusSummary(platformStatus, pageList) {
  const { preview, live, none } = countStatusBreakdown(platformStatus, pageList);
  const total = pageList.length;
  return `${live} live · ${preview} preview only · ${none} not deployed (${total} total)`;
}

/** @type {Record<'untouched'|'previewed'|'published', string>} */
const STATUS_COLOR = {
  untouched: '#c9252d',
  previewed: '#c9940a',
  published: '#2d8a4e',
};

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
      actions: {},
    };
  }
}

/**
 * @param {Record<string, string>} context
 * @returns {{ org: string, site: string, ref: string, folderPath: string }}
 */
function resolveSiteContext(context) {
  const params = new URLSearchParams(window.location.search);
  let org = String(context.org || context.owner || '').trim();
  let site = String(context.repo || context.site || '').trim();
  const ref = context.ref || params.get('ref') || 'main';
  const folderPath = resolveContentFolderPath(
    params.get('path') || context.path || '',
  );

  const appMatch = window.location.pathname.match(/\/app\/([^/]+)\/([^/]+)/);
  if (appMatch) {
    if (!org) org = appMatch[1];
    if (!site) site = appMatch[2];
  }

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
 * Small status dot only (no row tint). Meaning is in the top legend.
 * @param {'untouched'|'previewed'|'published'} status
 * @returns {HTMLElement}
 */
function buildStatusDot(status) {
  const dot = el('span', `bulk-pp-status-dot bulk-pp-status-dot-${status}`);
  const label = statusLabel(status);
  dot.setAttribute('aria-label', label);
  dot.title = label;
  return dot;
}

/** Placeholder keeps row alignment; no color until AEM status is known. */
function buildStatusDotPending() {
  const dot = el('span', 'bulk-pp-status-dot bulk-pp-status-dot-pending');
  dot.setAttribute('aria-label', 'Status loading');
  return dot;
}

/**
 * Colored status dots only after the full AEM status check finishes (not per-batch).
 * @param {Record<string, unknown>} state
 * @returns {boolean}
 */
function isStatusLoaded(state) {
  if (state.statusCheckFailed || state.statusChecking) return false;
  return pages.length > 0;
}

/**
 * @param {Record<string, unknown>} state
 * @returns {Record<string, import('./lib/page-history.js').PageHistoryEntry>}
 */
function buildStatusMap(state) {
  const platform = /** @type {Record<string, import('./lib/page-history.js').PageHistoryEntry>} */ (
    state.platformStatus || {}
  );
  /** @type {Record<string, import('./lib/page-history.js').PageHistoryEntry>} */
  const map = {};
  pages.forEach((page) => {
    map[page.helixPath] = platform[page.helixPath] || {};
  });
  return map;
}

/**
 * @param {DocumentEntry} page
 * @param {import('./lib/page-history.js').PageHistoryEntry | undefined} entry
 * @param {string} browseFolder
 * @param {(checked: boolean, path: string) => void} onToggle
 * @param {boolean} showStatus
 * @param {{ org: string, site: string, ref: string }} siteCtx
 * @returns {HTMLLIElement}
 */
function buildPageRow(page, entry, browseFolder, onToggle, showStatus, siteCtx) {
  const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-document');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'bulk-pp-page-cb';
  cb.value = page.helixPath;
  cb.dataset.path = page.helixPath;
  cb.checked = selected.has(page.helixPath);
  cb.id = `page-${page.helixPath.replace(/\W/g, '_')}`;
  cb.addEventListener('change', (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    onToggle(input.checked, input.dataset.path || input.value);
  });

  const icon = el('span', 'bulk-pp-item-icon bulk-pp-icon-document', '');
  icon.setAttribute('aria-hidden', 'true');

  const { title, subtitle } = formatPageListLabel(page.helixPath, page.name, browseFolder);
  const labelWrap = el('div', 'bulk-pp-item-main');
  const label = document.createElement('label');
  label.htmlFor = cb.id;
  label.className = 'bulk-pp-item-label';
  label.textContent = title;
  labelWrap.append(label);
  if (subtitle) labelWrap.append(el('span', 'bulk-pp-item-subtitle', subtitle));

  if (showStatus) {
    const dateParts = [];
    if (entry?.previewedAt) dateParts.push(`Preview ${formatStatusDate(entry.previewedAt)}`);
    if (entry?.publishedAt) dateParts.push(`Published ${formatStatusDate(entry.publishedAt)}`);
    if (dateParts.length) labelWrap.append(el('span', 'bulk-pp-item-dates', dateParts.join(' · ')));
  }

  const rowActions = el('div', 'bulk-pp-row-actions');
  const daUrl = buildDaEditUrl(
    siteCtx.org,
    siteCtx.site,
    page.helixPath,
    page.sourcePath,
    siteCtx.ref,
  );
  const daLink = document.createElement('a');
  daLink.className = 'bulk-pp-btn bulk-pp-btn-open-da';
  daLink.href = daUrl;
  daLink.target = '_top';
  daLink.rel = 'noopener noreferrer';
  daLink.textContent = 'DA';
  daLink.title = 'Open in Document Authoring';
  daLink.setAttribute('aria-label', `Open ${title} in Document Authoring`);
  if (!siteCtx.org || !siteCtx.site) {
    daLink.removeAttribute('href');
    daLink.classList.add('bulk-pp-btn-open-da-disabled');
    daLink.setAttribute('aria-disabled', 'true');
  }
  daLink.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!siteCtx.org || !siteCtx.site) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    try {
      (window.top || window).location.assign(daUrl);
    } catch {
      window.open(daUrl, '_blank', 'noopener,noreferrer');
    }
  });
  rowActions.append(daLink);
  if (showStatus) {
    rowActions.append(buildStatusDot(getPageStatus(entry)));
  } else {
    rowActions.append(buildStatusDotPending());
  }

  li.append(cb, icon, labelWrap, rowActions);
  return li;
}

/**
 * @returns {HTMLElement}
 */
function buildStatusLegend() {
  const legend = el('div', 'bulk-pp-status-legend');
  legend.setAttribute('aria-label', 'Status key');
  [
    ['untouched', 'not previewed'],
    ['previewed', 'only previewed'],
    ['published', 'Published'],
  ].forEach(([key, text]) => {
    const item = el('span', 'bulk-pp-legend-item');
    const dot = el('span', 'bulk-pp-legend-dot');
    dot.style.background = STATUS_COLOR[/** @type {keyof STATUS_COLOR} */ (key)];
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
    list.append(el('li', null, 'None in this list yet — AEM reports no matching deployment for loaded pages.'));
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
    pageScope,
    pageFilter,
    platformStatus,
    statusCheckFailed,
    statusError,
    statusChecking,
    statusProgressDone,
    statusProgressTotal,
  } = state;

  const statusMap = buildStatusMap(state);
  const browseFolder = resolveContentFolderPath(folderPath);
  const visiblePages = filterAndSortPages(
    pages,
    statusMap,
    String(pageFilter || 'all'),
    browseFolder,
  );

  document.getElementById('bulk-pp-runtime-styles')?.remove();

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
    const filterField = el('div', 'bulk-pp-field bulk-pp-field-filter');
    filterField.append(el('label', null, 'Filter'));
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
    filterRow.append(filterField, buildStatusLegend());
    pagesPane.append(filterRow);

    if (statusCheckFailed) {
      pagesPane.append(el(
        'p',
        'bulk-pp-status-note bulk-pp-status-note-error',
        statusError || 'Could not load deployment status from AEM. Open the tool from https://da.live (Document Authoring), not the .aem.live preview URL, then refresh.',
      ));
    } else if (pages.length > 0) {
      const summary = formatStatusSummary(platformStatus || {}, pages);
      let noteText = `Deployment status from AEM · ${summary}`;
      if (statusChecking && statusProgressTotal > 0) {
        const deployed = countDeployedPages(platformStatus || {}, pages);
        noteText = `Checking AEM status… ${statusProgressDone}/${statusProgressTotal} · ${deployed} matched so far`;
      }
      pagesPane.append(el('p', 'bulk-pp-status-note', noteText));
    }

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
          browseFolder,
          (checked, path) => {
            if (checked) selected.add(path);
            else selected.delete(path);
            state.onSelectionChange();
          },
          isStatusLoaded(state),
          { org, site, ref },
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
  const previewUrlPaths = pathsOnPreview(pages, statusMap);
  const publishedUrlPaths = pathsOnPublished(pages, statusMap);
  appendUrlSection(urlsPane, 'Preview (.aem.page)', host, buildUrlsForPaths(previewUrlPaths, org, site, ref, 'preview'));
  appendUrlSection(urlsPane, 'Published (.aem.live)', host, buildUrlsForPaths(publishedUrlPaths, org, site, ref, 'live'));
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

  if (statusChecking && statusProgressTotal > 0) {
    const progressWrap = el('div', 'bulk-pp-progress-wrap');
    progressWrap.setAttribute('role', 'progressbar');
    progressWrap.setAttribute('aria-valuemin', '0');
    progressWrap.setAttribute('aria-valuemax', String(statusProgressTotal));
    progressWrap.setAttribute('aria-valuenow', String(statusProgressDone));
    progressWrap.setAttribute('aria-label', 'Checking deployment status');
    const pct = Math.min(100, Math.round((statusProgressDone / statusProgressTotal) * 100));
    const track = el('div', 'bulk-pp-progress-track');
    const fill = el('div', 'bulk-pp-progress-fill');
    fill.style.width = `${pct}%`;
    track.append(fill);
    progressWrap.append(track);
    progressWrap.append(el(
      'p',
      'bulk-pp-progress-label',
      `${statusProgressDone} of ${statusProgressTotal} pages checked (${pct}%)`,
    ));
    root.append(progressWrap);
  }

  if (status) {
    const statusEl = el('div', `bulk-pp-status bulk-pp-status-${statusType || 'info'}`);
    statusEl.append(el('strong', null, status));
    if (jobDetail) statusEl.append(el('pre', 'bulk-pp-error-detail', jobDetail));
    root.append(statusEl);
  }

  root.append(el('p', 'bulk-pp-version', `v${TOOL_VERSION}`));

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
  ensureLatestToolCache();

  const app = document.getElementById('app');
  if (!app) return;

  const { context, actions } = await initSdk();
  const hasSdkFetch = typeof actions.daFetch === 'function';
  configureAdminApi({ useSdkFetch: hasSdkFetch });
  const daFetch = hasSdkFetch ? wrapDaFetch(actions.daFetch) : null;
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
    pageFilter: 'all',
    platformStatus: {},
    statusCheckFailed: false,
    statusError: null,
    statusChecking: false,
    statusProgressDone: 0,
    statusProgressTotal: 0,

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
        state.loading = false;

        if (folders.length === 0 && docCount === 0) {
          state.status = `No folders or pages in ${location}.`;
          state.statusType = 'info';
        } else if (state.pageScope === 'tree') {
          state.status = `${docCount} page(s) under ${location} (all subfolders) · checking status…`;
          state.statusType = 'success';
        } else {
          state.status = `${docCount} page(s) and ${folders.length} folder(s) in ${location} · checking status…`;
          state.statusType = 'success';
        }
        if (isHardcodeIndexTest()) {
          state.status = 'hardcodeIndex: GET admin.hlx.page/preview/…/main/index only (your API). See console. Other pages skipped.';
          state.statusType = 'info';
        }

        const pathsToCheck = pages.map((p) => p.helixPath);
        const statusLocation = location;
        state.statusChecking = pathsToCheck.length > 0;
        state.statusProgressDone = 0;
        state.statusProgressTotal = pathsToCheck.length;

        render(app, state);
        fetchPlatformStatusForPaths(
          daFetch,
          state.org,
          state.site,
          state.ref,
          pathsToCheck,
          (partial, done, total) => {
            state.platformStatus = { ...partial };
            state.statusProgressDone = done;
            state.statusProgressTotal = total;
            state.status = `Checking deployment status… ${done}/${total} · ${formatStatusSummary(state.platformStatus, pages)}`;
            state.statusType = 'info';
            render(app, state);
          },
        ).then((platformStatus) => {
          state.platformStatus = platformStatus;
          state.statusCheckFailed = false;
          state.statusError = null;
          state.statusChecking = false;
          state.statusProgressDone = pathsToCheck.length;
          state.statusProgressTotal = pathsToCheck.length;
          if (folders.length === 0 && docCount === 0) {
            state.status = `No folders or pages in ${statusLocation}.`;
          } else if (state.pageScope === 'tree') {
            state.status = `Status check complete · ${formatStatusSummary(platformStatus, pages)}`;
          } else {
            state.status = `Status check complete · ${formatStatusSummary(platformStatus, pages)}`;
          }
          state.statusType = 'success';
          if (new URLSearchParams(window.location.search).has('debug')) {
            // eslint-disable-next-line no-console
            console.debug('[bulk-pp] platformStatus', platformStatus);
          }
          render(app, state);
        }).catch((statusErr) => {
          state.statusChecking = false;
          state.platformStatus = {};
          state.statusCheckFailed = true;
          const raw = statusErr instanceof Error ? statusErr.message : 'Status check failed';
          state.statusError = formatAdminApiError({ message: raw }, 0) || raw;
          console.warn('[bulk-pp] platform status failed', statusErr);
          render(app, state);
        });

        if (new URLSearchParams(window.location.search).has('debug')) {
          // eslint-disable-next-line no-console
          console.debug('[bulk-pp] folders', folders, 'pages', pages);
        }
        return;
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
      const visible = filterAndSortPages(
        pages,
        buildStatusMap(state),
        String(state.pageFilter || 'all'),
        resolveContentFolderPath(state.folderPath),
      );
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

      const visible = filterAndSortPages(
        pages,
        buildStatusMap(state),
        String(state.pageFilter || 'all'),
        resolveContentFolderPath(state.folderPath),
      );
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
          state.activeTab = 'urls';
          try {
            state.statusChecking = paths.length > 0;
            const refreshed = await fetchPlatformStatusForPaths(
              daFetch,
              state.org,
              state.site,
              state.ref,
              paths,
            );
            state.platformStatus = { ...state.platformStatus, ...refreshed };
            state.statusChecking = false;
          } catch (refreshErr) {
            state.statusChecking = false;
            console.warn('[bulk-pp] status refresh after job failed', refreshErr);
          }
        }
        const showDetail = outcome.statusType === 'error'
          || new URLSearchParams(window.location.search).has('debug');
        state.jobDetail = showDetail ? JSON.stringify(finalJob, null, 2) : null;
      } catch (err) {
        const raw = err.message || 'Operation failed.';
        state.status = formatAdminApiError(err.data || { message: raw }, err.status) || raw;
        state.statusType = 'error';
        if (err.data) state.jobDetail = JSON.stringify(err.data, null, 2);
      } finally {
        state.loading = false;
        render(app, state);
      }
    },
  };

  if (!daFetch) {
    state.error = 'Open Bulk Preview & Publish from Document Authoring (https://da.live → Apps). Running outside the DA shell causes CORS and auth failures on admin.hlx.page.';
    state.statusType = 'error';
    render(app, state);
    return;
  }

  if (!ctx.org || !ctx.site) {
    state.error = 'Missing org or site from DA context. Open this tool from Document Authoring.';
    state.statusType = 'error';
    render(app, state);
    return;
  }

  await state.onLoad();
}

main();
