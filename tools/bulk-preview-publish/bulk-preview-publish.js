import {
  collectPages,
  fetchPlatformStatusForPaths,
  isHardcodeIndexTest,
  wrapDaFetch,
  formatAdminApiError,
  getJobPollUrl,
  listFolderEntries,
  pollJob,
  resolveJobOutcome,
  startBulkJob,
} from './lib/api.js?t=mpyxlouk';
import {
  displayFolderPath,
  formatPageListLabel,
  isSiteShellPage,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js?t=mpyxlouk';
import {
  buildDaEditUrl,
  buildSiteHost,
  buildUrlsForPaths,
} from './lib/urls.js?t=mpyxlouk';
import {
  countDeployedPages,
  formatDeploymentSummary,
  formatStatusDate,
  getPageStatus,
  PAGE_FILTERS,
  statusLabel,
} from './lib/page-history.js?t=mpyxlouk';
import { confirmTreeScopeFetch } from './lib/modal.js?t=mpyxlouk';
import {
  bindSearchInput,
  buildSearchField,
  patchFolderSearchResults,
  patchPageSearchResults,
  searchHintText,
} from './lib/search-ui.js?t=mpyxlouk';
import {
  cancelStatusCheck,
  createAppState,
  getVisiblePages,
  getVisibleFolders,
  isStatusLoaded,
  pruneSiteShellFromSelection,
  resetWorkspace,
  SEARCH_MIN_LEN,
  selectAllVisible,
} from './lib/state.js?t=mpyxlouk';
import { el } from './lib/dom.js?t=mpyxlouk';

/** @type {Record<'untouched'|'previewed'|'published', string>} */
const STATUS_COLOR = {
  untouched: '#c9252d',
  previewed: '#c9940a',
  published: '#2d8a4e',
};

const SDK_URL = 'https://da.live/nx/utils/sdk.js';
const SDK_TIMEOUT_MS = 8000;

async function initSdk() {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('DA SDK not available')), SDK_TIMEOUT_MS);
  });
  try {
    const mod = await import(SDK_URL);
    const sdk = await Promise.race([mod.default, timeout]);
    const { context = {}, actions = {} } = sdk;
    return { context, actions };
  } catch {
    return {
      context: {
        org: 'local-org',
        repo: 'local-repo',
        ref: 'main',
        path: '',
      },
      actions: {},
    };
  }
}

/**
 * @param {Record<string, string>} context
 */
function resolveSiteContext(context) {
  let org = String(context.org || context.owner || '').trim();
  let site = String(context.repo || context.site || '').trim();
  const ref = context.ref || 'main';
  const appMatch = window.location.pathname.match(/\/app\/([^/]+)\/([^/]+)/);
  if (appMatch) {
    if (!org) org = appMatch[1];
    if (!site) site = appMatch[2];
  }
  return { org, site, ref };
}

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

function createPanel(title, extraClass = '') {
  const panel = el('section', `bulk-pp-panel ${extraClass}`.trim());
  const head = el('div', 'bulk-pp-panel-head');
  head.append(el('h2', null, title));
  const body = el('div', 'bulk-pp-panel-body');
  panel.append(head, body);
  return { panel, body };
}

function buildBreadcrumb(folderPath, onNavigate, locked = false) {
  const nav = el('nav', 'bulk-pp-breadcrumb');
  nav.setAttribute('aria-label', 'Folder path');
  const rootBtn = el('button', 'bulk-pp-breadcrumb-segment', 'Back to root');
  rootBtn.type = 'button';
  rootBtn.disabled = locked;
  if (!locked) rootBtn.addEventListener('click', () => onNavigate(''));
  nav.append(rootBtn);
  const segments = normalizeFolderPath(folderPath).split('/').filter(Boolean);
  segments.forEach((segment, index) => {
    nav.append(el('span', 'bulk-pp-breadcrumb-sep', '›'));
    const path = segments.slice(0, index + 1).join('/');
    if (index === segments.length - 1) {
      nav.append(el('span', 'bulk-pp-breadcrumb-current', segment));
    } else {
      const btn = el('button', 'bulk-pp-breadcrumb-segment', segment);
      btn.type = 'button';
      btn.disabled = locked;
      if (!locked) btn.addEventListener('click', () => onNavigate(path));
      nav.append(btn);
    }
  });
  return nav;
}

function buildFolderRow(folder, onNavigate, locked = false) {
  const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-folder');
  if (locked) li.classList.add('bulk-pp-list-item-locked');
  const icon = el('span', 'bulk-pp-item-icon bulk-pp-icon-folder', '');
  icon.setAttribute('aria-hidden', 'true');
  const link = el('button', 'bulk-pp-folder-link', folder.name);
  link.type = 'button';
  link.disabled = locked;
  if (locked) {
    link.title = 'Unavailable while status is loading';
    link.setAttribute('aria-disabled', 'true');
  } else {
    link.title = `Open ${folder.name}`;
    link.setAttribute('aria-label', `Open folder ${folder.name}`);
  }
  link.addEventListener('click', (e) => {
    if (locked) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onNavigate(folder.folderPath);
  });
  li.append(icon, link);
  if (!locked) {
    li.addEventListener('click', (e) => {
      if (e.target !== link) link.click();
    });
  }
  return li;
}

function buildStatusDot(status) {
  const dot = el('span', `bulk-pp-status-dot bulk-pp-status-dot-${status}`);
  dot.setAttribute('aria-label', statusLabel(status));
  dot.title = statusLabel(status);
  return dot;
}

function buildStatusDotPending() {
  const dot = el('span', 'bulk-pp-status-dot bulk-pp-status-dot-pending');
  dot.setAttribute('aria-label', 'Status loading');
  return dot;
}

function buildPageRow(page, entry, browseFolder, state, showStatus, siteCtx, interactionsLocked = false) {
  const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-document');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'bulk-pp-page-cb';
  cb.value = page.helixPath;
  cb.dataset.path = page.helixPath;
  cb.checked = !isSiteShellPage(page) && state.selected.has(page.helixPath);
  cb.disabled = interactionsLocked;
  cb.id = `page-${page.helixPath.replace(/\W/g, '_')}`;
  cb.addEventListener('change', (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const path = input.dataset.path || input.value;
    if (input.checked) state.selected.add(path);
    else state.selected.delete(path);
    state.onSelectionChange();
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
  const daUrl = buildDaEditUrl(siteCtx.org, siteCtx.site, page.helixPath, page.sourcePath, siteCtx.ref);
  const daLink = document.createElement('a');
  daLink.className = 'bulk-pp-btn bulk-pp-btn-open-da';
  if (interactionsLocked) {
    daLink.classList.add('bulk-pp-btn-open-da-disabled');
    daLink.setAttribute('aria-disabled', 'true');
    daLink.title = 'Unavailable while status is loading';
    daLink.textContent = 'DA';
    daLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  } else {
    daLink.href = daUrl;
    daLink.target = '_top';
    daLink.rel = 'noopener noreferrer';
    daLink.textContent = 'DA';
    daLink.title = 'Open in Document Authoring';
    daLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        (window.top || window).location.assign(daUrl);
      } catch {
        window.open(daUrl, '_blank', 'noopener,noreferrer');
      }
    });
  }
  rowActions.append(daLink);
  rowActions.append(showStatus ? buildStatusDot(getPageStatus(entry)) : buildStatusDotPending());
  li.append(cb, icon, labelWrap, rowActions);
  return li;
}

function buildStatusLegend() {
  const legend = el('div', 'bulk-pp-status-legend');
  legend.setAttribute('aria-label', 'Status key');
  [
    ['untouched', 'Not previewed'],
    ['previewed', 'Preview only'],
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

function buildStatusProgressBar(state, showCancel) {
  const wrap = el('div', 'bulk-pp-status-active');
  wrap.id = 'bulk-pp-status-active';
  const head = el('div', 'bulk-pp-status-active-head');
  head.append(el('strong', null, 'Checking preview & publish status'));
  if (showCancel) {
    const cancelBtn = el('button', 'bulk-pp-btn bulk-pp-btn-ghost bulk-pp-btn-cancel-status', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.id = 'bulk-pp-cancel-status';
    cancelBtn.addEventListener('click', () => state.onCancelStatus());
    head.append(cancelBtn);
  }
  wrap.append(head);

  const pct = state.statusProgressTotal > 0
    ? Math.min(100, Math.round((state.statusProgressDone / state.statusProgressTotal) * 100))
    : 0;
  const track = el('div', 'bulk-pp-progress-track');
  const fill = el('div', 'bulk-pp-progress-fill');
  fill.id = 'bulk-pp-progress-fill';
  fill.style.width = `${pct}%`;
  track.append(fill);
  wrap.append(track);
  wrap.append(el(
    'p',
    'bulk-pp-progress-label',
    `${state.statusProgressDone} of ${state.statusProgressTotal} pages checked (${pct}%)`,
  ));
  const label = wrap.querySelector('.bulk-pp-progress-label');
  if (label) label.id = 'bulk-pp-progress-label';
  wrap.setAttribute('role', 'progressbar');
  wrap.setAttribute('aria-valuemin', '0');
  wrap.setAttribute('aria-valuemax', String(state.statusProgressTotal));
  wrap.setAttribute('aria-valuenow', String(state.statusProgressDone));
  return wrap;
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchStatusProgressUI(root, state) {
  const fill = root.querySelector('#bulk-pp-progress-fill');
  const label = root.querySelector('#bulk-pp-progress-label');
  const note = root.querySelector('#bulk-pp-status-note');
  const active = root.querySelector('#bulk-pp-status-active');
  const pct = state.statusProgressTotal > 0
    ? Math.min(100, Math.round((state.statusProgressDone / state.statusProgressTotal) * 100))
    : 0;
  if (fill instanceof HTMLElement) fill.style.width = `${pct}%`;
  if (label) {
    label.textContent = `${state.statusProgressDone} of ${state.statusProgressTotal} pages checked (${pct}%)`;
  }
  if (active) {
    active.setAttribute('aria-valuenow', String(state.statusProgressDone));
  }
  if (note && state.pages.length > 0) {
    const deployed = countDeployedPages(state.platformStatus, state.pages);
    note.textContent = `Checking AEM status… ${state.statusProgressDone}/${state.statusProgressTotal} · ${deployed} matched so far`;
  }
}

function appendUrlSection(container, title, host, urls) {
  const section = el('div', 'bulk-pp-url-section');
  section.append(el('h3', 'bulk-pp-url-section-title', title));
  section.append(el('p', 'bulk-pp-url-host', host));
  const listWrap = el('div', 'bulk-pp-list-wrap');
  const list = el('ul', 'bulk-pp-url-list');
  if (urls.length === 0) {
    list.append(el('li', 'bulk-pp-list-empty', 'No URLs for this operation.'));
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

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function render(root, state) {
  const listWrapBefore = document.getElementById('bulk-pp-page-list-wrap');
  const savedListScroll = listWrapBefore ? listWrapBefore.scrollTop : null;
  const savedWindowY = window.scrollY;

  const {
    org, site, ref, folderPath, loading, error, status, statusType, jobDetail,
    activeTab, pageScope, pageFilter, statusCheckFailed, statusError,
    statusChecking, pageSearch, folderSearch, contentLoading, lastOperation,
  } = state;

  const { visible: visiblePages, statusMap, browseFolder } = getVisiblePages(state);
  const visibleFolders = getVisibleFolders(state);
  const busy = loading || contentLoading || statusChecking;
  const searchDraft = String(pageSearch || '').trim();
  const searchTooShort = searchDraft.length > 0 && searchDraft.length < SEARCH_MIN_LEN;
  const folderSearchDraft = String(folderSearch || '').trim();
  const folderSearchTooShort = folderSearchDraft.length > 0
    && folderSearchDraft.length < SEARCH_MIN_LEN;

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
  pathInput.disabled = busy;
  pathField.append(pathInput);
  row.append(pathField);

  const depthField = el('div', 'bulk-pp-field bulk-pp-field-narrow');
  depthField.append(el('label', null, 'Pages to show'));
  const depthSelect = document.createElement('select');
  depthSelect.id = 'bulk-pp-depth';
  depthSelect.disabled = busy;
  [['folder', 'This folder'], ['tree', 'All subfolders']].forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === pageScope) opt.selected = true;
    depthSelect.append(opt);
  });
  depthField.append(depthSelect);
  row.append(depthField);

  const fetchBtn = el('button', 'bulk-pp-btn bulk-pp-btn-primary', contentLoading ? 'Fetching…' : 'Fetch');
  fetchBtn.type = 'button';
  fetchBtn.id = 'bulk-pp-fetch-btn';
  fetchBtn.disabled = busy;
  row.append(fetchBtn);
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
  pagesPane.append(buildBreadcrumb(safeFolder, (path) => state.onNavigate(path), statusChecking));

  if (contentLoading && activeTab === 'pages') {
    pagesPane.append(el('p', 'bulk-pp-list-empty', 'Fetching content…'));
  } else if (error && activeTab === 'pages') {
    pagesPane.append(el('p', 'bulk-pp-list-empty bulk-pp-list-empty-error', error));
  } else if (state.pages.length === 0 && state.folders.length === 0 && !statusChecking) {
    pagesPane.append(el(
      'p',
      'bulk-pp-list-empty',
      'Choose a folder scope and click Fetch to load pages.',
    ));
  } else {
    const filterRow = el('div', 'bulk-pp-filter-row');
    const filterField = el('div', 'bulk-pp-field bulk-pp-field-filter');
    filterField.append(el('label', null, 'Filter'));
    const filterSelect = document.createElement('select');
    filterSelect.id = 'bulk-pp-page-filter';
    filterSelect.disabled = statusChecking;
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

    if (state.folders.length > 0) {
      const folderSection = el('section', 'bulk-pp-content-section bulk-pp-content-section-folders');
      const folderHead = el('div', 'bulk-pp-section-head');
      const folderCountLabel = folderSearchDraft && !folderSearchTooShort
        ? `${visibleFolders.length} of ${state.folders.length}`
        : String(state.folders.length);
      const folderCountEl = el('span', 'bulk-pp-section-count', folderCountLabel);
      folderCountEl.id = 'bulk-pp-folder-count';
      folderHead.append(
        el('h3', 'bulk-pp-section-title', 'Folders'),
        folderCountEl,
      );
      folderSection.append(folderHead);

      const { wrap: folderSearchField, input: folderSearchInput } = buildSearchField(
        'bulk-pp-folder-search',
        'Search folders',
        String(folderSearch || ''),
        statusChecking,
        searchHintText(folderSearch),
      );
      const folderSearchRow = el('div', 'bulk-pp-search-row');
      folderSearchRow.append(folderSearchField);
      folderSection.append(folderSearchRow);

      const folderWrap = el('div', 'bulk-pp-list-wrap bulk-pp-list-wrap-folders');
      const folderList = el('ul', 'bulk-pp-list');
      folderList.id = 'bulk-pp-folder-list';
      if (visibleFolders.length === 0) {
        const folderEmptyMsg = folderSearchTooShort
          ? `Type at least ${SEARCH_MIN_LEN} characters to search.`
          : folderSearchDraft
            ? 'No folders match this search.'
            : 'No folders in this location.';
        folderList.append(el('li', 'bulk-pp-list-empty', folderEmptyMsg));
      } else {
        visibleFolders.forEach((folder) => {
          folderList.append(buildFolderRow(
            folder,
            (path) => state.onNavigate(path),
            statusChecking,
          ));
        });
      }
      folderWrap.append(folderList);
      folderSection.append(folderWrap);
      pagesPane.append(folderSection);

      bindSearchInput(folderSearchInput, state, 'folder', () => {
        patchFolderSearchResults(root, state, buildFolderRow);
      });
    }

    if (statusChecking) {
      pagesPane.append(buildStatusProgressBar(state, true));
    } else if (statusCheckFailed) {
      pagesPane.append(el(
        'p',
        'bulk-pp-status-note bulk-pp-status-note-error',
        statusError || 'Could not load deployment status from AEM.',
      ));
    } else if (state.pages.length > 0) {
      pagesPane.append(el(
        'p',
        'bulk-pp-status-note',
        `Deployment status from AEM · ${formatDeploymentSummary(state.platformStatus, state.pages)}`,
      ));
      const note = pagesPane.querySelector('.bulk-pp-status-note:last-of-type');
      if (note) note.id = 'bulk-pp-status-note';
    }

    const pagesSection = el('section', 'bulk-pp-content-section bulk-pp-content-section-pages');
    const pagesHead = el('div', 'bulk-pp-section-head');
    const pageCountLabel = searchDraft && !searchTooShort
      ? `${visiblePages.length} of ${state.pages.length}`
      : String(state.pages.length);
    const pageCountEl = el('span', 'bulk-pp-section-count', pageCountLabel);
    pageCountEl.id = 'bulk-pp-page-count';
    pagesHead.append(
      el('h3', 'bulk-pp-section-title', 'Pages'),
      pageCountEl,
    );
    pagesSection.append(pagesHead);

    const pagesMeta = el('div', 'bulk-pp-pages-meta');
    pagesMeta.append(buildStatusLegend());
    pagesSection.append(pagesMeta);

    const { wrap: searchField, input: searchInput } = buildSearchField(
      'bulk-pp-page-search',
      'Search pages',
      String(pageSearch || ''),
      statusChecking,
      searchHintText(pageSearch),
    );
    const searchRow = el('div', 'bulk-pp-search-row');
    searchRow.append(searchField);
    pagesSection.append(searchRow);

    const toolbar = el('div', 'bulk-pp-toolbar');
    const toolbarActions = el('div', 'bulk-pp-toolbar-actions');
    const selectAllBtn = el('button', 'bulk-pp-btn bulk-pp-btn-ghost', 'Select all');
    const selectNoneBtn = el('button', 'bulk-pp-btn bulk-pp-btn-ghost', 'Select none');
    selectAllBtn.type = 'button';
    selectNoneBtn.type = 'button';
    selectAllBtn.id = 'bulk-pp-select-all';
    selectNoneBtn.id = 'bulk-pp-select-none';
    selectAllBtn.disabled = visiblePages.length === 0 || statusChecking;
    selectNoneBtn.disabled = visiblePages.length === 0 || statusChecking;
    selectAllBtn.addEventListener('click', () => state.onSelectAll(true));
    selectNoneBtn.addEventListener('click', () => state.onSelectAll(false));
    toolbarActions.append(selectAllBtn, selectNoneBtn);
    const visibleCount = visiblePages.length;
    const totalCount = state.pages.length;
    const pillText = visibleCount === totalCount
      ? `${state.selected.size} of ${totalCount} selected`
      : `${state.selected.size} selected · ${visibleCount} shown (${totalCount} total)`;
    toolbar.append(toolbarActions, el('span', 'bulk-pp-selection-pill', pillText));
    toolbar.querySelector('.bulk-pp-selection-pill').id = 'bulk-pp-selection-pill';
    pagesSection.append(toolbar);

    const pageWrap = el('div', 'bulk-pp-list-wrap');
    pageWrap.id = 'bulk-pp-page-list-wrap';
    const pageList = el('ul', 'bulk-pp-list');
    pageList.id = 'bulk-pp-page-list';
    if (state.pages.length === 0) {
      pageList.append(el('li', 'bulk-pp-list-empty', 'No pages in this scope.'));
    } else if (visiblePages.length === 0) {
      const emptyMsg = searchTooShort
        ? `Type at least ${SEARCH_MIN_LEN} characters to search.`
        : searchDraft
          ? 'No pages match this search.'
          : 'No pages match this filter.';
      pageList.append(el('li', 'bulk-pp-list-empty', emptyMsg));
    } else {
      visiblePages.forEach((page) => {
        pageList.append(buildPageRow(
          page,
          statusMap[page.helixPath],
          browseFolder,
          state,
          isStatusLoaded(state),
          { org, site, ref },
          statusChecking,
        ));
      });
    }
    pageWrap.append(pageList);
    pagesSection.append(pageWrap);
    pagesPane.append(pagesSection);

    filterSelect.addEventListener('change', () => {
      state.pageFilter = filterSelect.value;
      patchPageSearchResults(root, state, { org, site, ref }, buildPageRow);
    });
    bindSearchInput(searchInput, state, 'page', () => {
      patchPageSearchResults(root, state, { org, site, ref }, buildPageRow);
    });
  }
  contentPanel.append(pagesPane);

  const urlsPane = el('div', 'bulk-pp-tab-pane');
  if (activeTab === 'urls') urlsPane.classList.add('bulk-pp-tab-pane-active');
  if (lastOperation) {
    appendUrlSection(urlsPane, lastOperation.title, lastOperation.host, lastOperation.urls);
    urlsPane.append(el(
      'p',
      'bulk-pp-url-operation-note',
      `${lastOperation.paths.length} page(s) · completed ${new Date(lastOperation.completedAt).toLocaleString()}`,
    ));
  } else {
    urlsPane.append(el(
      'p',
      'bulk-pp-list-empty',
      'Run Preview or Publish on selected pages to see URLs from that operation here.',
    ));
  }
  contentPanel.append(urlsPane);
  root.append(contentPanel);

  if (!statusChecking) {
    const { panel: runPanel, body: runBody } = createPanel('Run bulk actions', 'bulk-pp-actions-panel');
    const runRow = el('div', 'bulk-pp-run-actions');
    const previewBtn = el('button', 'bulk-pp-btn bulk-pp-btn-primary', 'Preview selected');
    const publishBtn = el('button', 'bulk-pp-btn bulk-pp-btn-danger', 'Publish to live');
    previewBtn.type = 'button';
    publishBtn.type = 'button';
    previewBtn.id = 'bulk-pp-preview-btn';
    publishBtn.id = 'bulk-pp-publish-btn';
    const runDisabled = loading || state.pages.length === 0 || state.selected.size === 0;
    previewBtn.disabled = runDisabled;
    publishBtn.disabled = runDisabled;
    runRow.append(previewBtn, publishBtn);
    runBody.append(runRow);
    root.append(runPanel);
    previewBtn.addEventListener('click', () => state.onRun('preview'));
    publishBtn.addEventListener('click', () => state.onRun('live'));
  }

  if (status && !statusChecking) {
    const statusEl = el('div', `bulk-pp-status bulk-pp-status-${statusType || 'info'}`);
    statusEl.append(el('strong', null, status));
    if (jobDetail) statusEl.append(el('pre', 'bulk-pp-error-detail', jobDetail));
    root.append(statusEl);
  }

  pathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') state.onFetch(false);
  });
  pathInput.addEventListener('change', () => {
    state.folderPath = normalizeFolderPath(pathInput.value.trim());
  });
  fetchBtn.addEventListener('click', () => state.onFetch(false));
  pagesTabBtn.addEventListener('click', () => state.onTab('pages'));
  urlsTabBtn.addEventListener('click', () => state.onTab('urls'));

  requestAnimationFrame(() => {
    if (savedListScroll != null) {
      const listWrap = document.getElementById('bulk-pp-page-list-wrap');
      if (listWrap) listWrap.scrollTop = savedListScroll;
    }
    if (savedWindowY > 0) window.scrollTo(0, savedWindowY);
  });
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {Function | null} daFetch
 * @param {string[]} pathsToCheck
 * @param {string} location
 * @param {number} docCount
 * @param {number} folderCount
 */
function startStatusCheck(state, daFetch, pathsToCheck, location, docCount, folderCount) {
  cancelStatusCheck(state, false);
  state.statusCancelled = false;
  state.statusCheckFailed = false;
  state.statusError = null;
  state.statusChecking = pathsToCheck.length > 0;
  state.statusProgressDone = 0;
  state.statusProgressTotal = pathsToCheck.length;
  state.statusAbort = new AbortController();

  if (pathsToCheck.length === 0) {
    state.statusChecking = false;
    state.status = folderCount === 0 && docCount === 0
      ? `No folders or pages in ${location}.`
      : `Loaded ${docCount} page(s) in ${location}.`;
    state.statusType = 'info';
    render(/** @type {HTMLElement} */ (state.root), state);
    return;
  }

  render(/** @type {HTMLElement} */ (state.root), state);

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
      patchStatusProgressUI(/** @type {HTMLElement} */ (state.root), state);
    },
    { signal: state.statusAbort.signal },
  ).then((platformStatus) => {
    if (state.statusAbort?.signal.aborted) return;
    state.platformStatus = platformStatus;
    state.statusChecking = false;
    state.statusAbort = null;
    state.statusProgressDone = pathsToCheck.length;
    state.statusProgressTotal = pathsToCheck.length;
    state.status = `Status check complete · ${formatDeploymentSummary(platformStatus, state.pages)}`;
    state.statusType = 'success';
    render(/** @type {HTMLElement} */ (state.root), state);
  }).catch((statusErr) => {
    if (statusErr instanceof DOMException && statusErr.name === 'AbortError') {
      state.statusAbort = null;
      render(/** @type {HTMLElement} */ (state.root), state);
      return;
    }
    state.statusChecking = false;
    state.statusAbort = null;
    state.statusCheckFailed = true;
    const raw = statusErr instanceof Error ? statusErr.message : 'Status check failed';
    state.statusError = formatAdminApiError({ message: raw }, 0) || raw;
    console.warn('[bulk-pp] platform status failed', statusErr);
    render(/** @type {HTMLElement} */ (state.root), state);
  });
}

async function main() {
  const app = document.getElementById('app');
  if (!app) return;

  const { context, actions } = await initSdk();
  const hasSdkFetch = typeof actions.daFetch === 'function';
  const daFetch = hasSdkFetch ? wrapDaFetch(actions.daFetch) : null;
  const ctx = resolveSiteContext(context);

  const state = createAppState(ctx);
  state.root = app;
  resetWorkspace(state);
  syncUrlPath(state.ref, '');

  state.onTab = (tab) => {
    state.activeTab = tab;
    render(app, state);
  };

  state.onCancelStatus = () => {
    cancelStatusCheck(state, true);
    render(app, state);
  };

  state.onNavigate = async (targetPath) => {
    cancelStatusCheck(state, false);
    state.folderPath = resolveContentFolderPath(targetPath);
    state.pageSearch = '';
    state.folderSearch = '';
    syncUrlPath(state.ref, state.folderPath);
    await state.onFetch(true);
  };

  state.onFetch = async (fromFolderNav = false) => {
    if (state.statusChecking) return;

    if (!fromFolderNav) {
      const pathInput = document.getElementById('bulk-pp-path');
      const depthSelect = document.getElementById('bulk-pp-depth');
      const rawPath = pathInput instanceof HTMLInputElement ? pathInput.value : '';
      state.folderPath = resolveContentFolderPath(normalizeFolderPath(rawPath));
      if (depthSelect instanceof HTMLSelectElement) {
        state.pageScope = depthSelect.value === 'tree' ? 'tree' : 'folder';
      }
    }

    if (state.pageScope === 'tree' && !fromFolderNav) {
      const ok = await confirmTreeScopeFetch();
      if (!ok) return;
    }

    if (!state.org || !state.site) {
      state.error = 'Missing org or site in DA context. Open this app from Document Authoring.';
      render(app, state);
      return;
    }

    syncUrlPath(state.ref, state.folderPath);
    cancelStatusCheck(state, false);
    state.contentLoading = true;
    state.error = null;
    state.statusCancelled = false;
    state.platformStatus = {};
    state.statusCheckFailed = false;
    state.statusError = null;
    if (!fromFolderNav) {
      state.pageSearch = '';
      state.folderSearch = '';
      state.selected.clear();
    }
    state.status = 'Fetching content…';
    state.statusType = 'info';
    render(app, state);

    try {
      const browseEntries = await listFolderEntries(
        daFetch,
        state.org,
        state.site,
        state.folderPath,
      );
      state.folders = browseEntries.filter((e) => e.kind === 'folder');

      if (state.pageScope === 'tree') {
        const nestedPages = await collectPages(
          daFetch,
          state.org,
          state.site,
          state.folderPath,
          -1,
        );
        state.pages = nestedPages.map((page) => ({
          kind: 'document',
          name: page.name,
          sourcePath: page.sourcePath,
          helixPath: page.helixPath,
        }));
      } else {
        state.pages = browseEntries.filter((e) => e.kind === 'document');
      }

      if (fromFolderNav) {
        const prev = new Set(state.selected);
        state.selected.clear();
        state.pages.forEach((p) => {
          if (prev.has(p.helixPath)) state.selected.add(p.helixPath);
        });
      }
      pruneSiteShellFromSelection(state);

      const docCount = state.pages.length;
      const location = displayFolderPath(state.folderPath) || 'site root';
      state.contentLoading = false;

      if (isHardcodeIndexTest()) {
        state.status = 'hardcodeIndex test mode — index only.';
        state.statusType = 'info';
      } else if (state.pageScope === 'tree') {
        state.status = `${docCount} page(s) under ${location} · checking status…`;
        state.statusType = 'success';
      } else {
        state.status = `${docCount} page(s) and ${state.folders.length} folder(s) in ${location} · checking status…`;
        state.statusType = 'success';
      }

      startStatusCheck(
        state,
        daFetch,
        state.pages.map((p) => p.helixPath),
        location,
        docCount,
        state.folders.length,
      );
    } catch (err) {
      state.folders = [];
      state.pages = [];
      state.selected.clear();
      state.contentLoading = false;
      state.error = err instanceof Error ? err.message : 'Failed to load content.';
      state.status = null;
      render(app, state);
    }
  };

  state.onSelectAll = (checked) => {
    selectAllVisible(state, checked);
    const root = state.root;
    if (root?.querySelector('#bulk-pp-page-list')) {
      patchPageSearchResults(
        root,
        state,
        { org: state.org, site: state.site, ref: state.ref },
        buildPageRow,
      );
    } else {
      render(app, state);
    }
  };

  state.onSelectionChange = () => {
    const root = state.root;
    if (!root) return;
    const { visible } = getVisiblePages(state);
    const pill = root.querySelector('#bulk-pp-selection-pill');
    if (pill) {
      const visibleCount = visible.length;
      const totalCount = state.pages.length;
      pill.textContent = visibleCount === totalCount
        ? `${state.selected.size} of ${totalCount} selected`
        : `${state.selected.size} selected · ${visibleCount} shown (${totalCount} total)`;
    }
    root.querySelectorAll('.bulk-pp-page-cb').forEach((cb) => {
      if (!(cb instanceof HTMLInputElement)) return;
      const path = cb.dataset.path || cb.value;
      cb.checked = state.selected.has(path);
    });
    const disabled = state.pages.length === 0 || state.selected.size === 0;
    root.querySelectorAll('#bulk-pp-preview-btn, #bulk-pp-publish-btn').forEach((btn) => {
      if (btn instanceof HTMLButtonElement) btn.disabled = disabled;
    });
  };

  state.onRun = async (topic) => {
    const paths = [...state.selected];
    if (paths.length === 0) return;

    if (topic === 'live') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Publish ${paths.length} page(s) to LIVE?\n\nThis updates the production site.`)) return;
    }

    state.loading = true;
    state.status = topic === 'live'
      ? `Starting bulk publish for ${paths.length} page(s)…`
      : `Starting bulk preview for ${paths.length} page(s)…`;
    state.statusType = 'info';
    state.jobDetail = null;
    render(app, state);

    const host = buildSiteHost(state.org, state.site, state.ref);
    const env = topic === 'live' ? 'live' : 'preview';

    try {
      const bulkResp = await startBulkJob(
        daFetch,
        state.org,
        state.site,
        state.ref,
        topic,
        paths,
      );

      const jobUrl = getJobPollUrl(bulkResp, state.org, state.site, state.ref, topic);
      if (!jobUrl) {
        const urls = buildUrlsForPaths(paths, state.org, state.site, state.ref, env);
        state.lastOperation = {
          topic,
          paths,
          urls,
          host,
          title: topic === 'live' ? 'Published (.aem.live)' : 'Preview (.aem.page)',
          completedAt: Date.now(),
        };
        state.status = topic === 'live'
          ? `Bulk publish scheduled (${paths.length} paths).`
          : `Bulk preview scheduled (${paths.length} paths).`;
        state.statusType = 'success';
        state.activeTab = 'urls';
        return;
      }

      state.status = 'Job running…';
      const finalJob = await pollJob(daFetch, jobUrl, (job) => {
        const progress = job.progress || job.job?.progress;
        if (progress && typeof progress === 'object') {
          const { total, processed, failed } = /** @type {{ total?: number, processed?: number, failed?: number }} */ (progress);
          state.status = `Job: ${job.state || 'running'} — ${processed ?? 0}/${total ?? '?'} processed (${failed ?? 0} failed)`;
          render(app, state);
        }
      });

      const outcome = resolveJobOutcome(finalJob);
      const action = topic === 'live' ? 'Bulk publish' : 'Bulk preview';
      state.status = `${action} ${outcome.message}`;
      state.statusType = outcome.statusType;

      if (outcome.statusType === 'success') {
        const urls = buildUrlsForPaths(paths, state.org, state.site, state.ref, env);
        state.lastOperation = {
          topic,
          paths,
          urls,
          host,
          title: topic === 'live' ? 'Published (.aem.live)' : 'Preview (.aem.page)',
          completedAt: Date.now(),
        };
        state.activeTab = 'urls';
        try {
          const refreshed = await fetchPlatformStatusForPaths(
            daFetch,
            state.org,
            state.site,
            state.ref,
            paths,
          );
          state.platformStatus = { ...state.platformStatus, ...refreshed };
        } catch (refreshErr) {
          console.warn('[bulk-pp] status refresh after job failed', refreshErr);
        }
      }

      state.jobDetail = outcome.statusType === 'error'
        || new URLSearchParams(window.location.search).has('debug')
        ? JSON.stringify(finalJob, null, 2)
        : null;
    } catch (err) {
      const raw = err.message || 'Operation failed.';
      state.status = formatAdminApiError(err.data || { message: raw }, err.status) || raw;
      state.statusType = 'error';
      if (err.data) state.jobDetail = JSON.stringify(err.data, null, 2);
    } finally {
      state.loading = false;
      render(app, state);
    }
  };

  if (!daFetch) {
    state.error = 'Open Bulk Preview & Publish from Document Authoring (https://da.live → Apps).';
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

  render(app, state);
}

main();
