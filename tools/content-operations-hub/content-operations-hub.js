/* eslint-disable no-use-before-define, prefer-destructuring, no-void, no-shadow, no-console, no-unused-vars, no-unused-expressions, operator-linebreak, max-len */

import {
  collectPages,
  wrapDaFetch,
  messageFromApiError,
  listFolderEntries,
  DA_LOGIN_REQUIRED_MESSAGE,
  DA_SITE_CONTEXT_MESSAGE,
  isDaAccessError,
} from './lib/api.js';
import {
  readBrowseLocation,
  writeBrowseLocation,
} from './lib/browse-persist.js';
import {
  displayFolderPath,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js';
import {
  persistCurrentPlatformStatus,
} from './lib/status-cache.js';
import {
  formatStatusFetchedAt,
  PAGE_FILTERS,
  countStatusBreakdown,
} from './lib/page-history.js';
import {
  closeProgressModal,
  showJobCancelledModal,
} from './lib/progress-modal.js';
import { formatRuntimeStatusEta } from './lib/status-estimate.js';
import {
  bindSearchInput,
  buildSearchField,
  pagesLocationMetaText,
  patchFolderSearchResults,
  patchPageSearchResults,
  searchHintText,
  syncSelectionUI,
  syncWorkspaceInteractivity,
} from './lib/search-ui.js';
import {
  cancelBulkJob,
  cancelStatusCheck,
  clearPageWorkspaceAfterOperation,
  createAppState,
  getVisiblePages,
  isDeploymentStatusPending,
  isFirstSessionStatusPending,
  isStatusFetchBlocking,
  isStatusFetchLockingUi,
  markInitialStatusFetchComplete,
  shouldShowPageStatus,
  resetWorkspace,
  SEARCH_MIN_LEN,
  resetPagesViewState,
  selectAllVisible,
} from './lib/state.js';
import {
  expandFolderAncestors,
  getFolderCountLabel,
  hydrateFolderTreeToPath,
  loadFolderTreeChildren,
  patchFolderTree,
  renderFolderTree,
  seedFolderTreeCache,
} from './lib/folder-tree.js';
import { el, safeQuery, setAccessibilityLabel, DOM_IDS, DOM_SELECTORS } from './lib/dom.js';
import { TIMING } from './lib/constants.js';
import { configureAppHooks } from './lib/app-hooks.js';
import { patchOrRender } from './lib/ui-patch.js';
import { patchStatusBanner } from './lib/status-banner.js';
import { buildPageRow, buildPageListColumnHeader, bindPageListSelection } from './lib/page-list.js';
import { buildSelectionActionBar } from './lib/selection-bar.js';
import {
  startStatusCheck,
  finishContentLoadWithoutStatus,
  formatStatusAccessMessage,
} from './lib/status-check.js';
import {
  bindJobRunHandlers,
  jobActionLabel,
  finishProgressModal,
} from './lib/job-runners.js';

/* ========================================
   CONFIGURATION & CONSTANTS
   ======================================== */

/** @typedef {'preview'|'live'|'unpreview'|'unpublish'|'delete'} JobTopic */

const SDK_URL = 'https://da.live/nx/utils/sdk.js';

const APP_TITLE = 'Content Operations Hub';
const APP_DESCRIPTION = 'Browse site content, monitor deployment status, and run bulk preview, publish, and removal operations.';

/**
 * @param {string} label
 * @param {string} value
 * @param {boolean} [muted]
 */
function buildMetaBadge(label, value, muted = false) {
  const badge = el('span', `bulk-pp-badge${muted ? ' bulk-pp-badge-muted' : ''}`);
  badge.title = label;
  badge.append(
    el('span', 'bulk-pp-badge-label', label),
    el('span', 'bulk-pp-badge-value', value),
  );
  return badge;
}

/* ========================================
   DOM UTILITIES
   ======================================== */

/**
 * Clear an input element's value safely
 * @param {HTMLElement | null} root
 * @param {string} selector
 */
function clearInputValue(root, selector) {
  const input = safeQuery(root, selector, HTMLInputElement);
  if (input) input.value = '';
}

/**
 * Safely clears filter select to 'all' option
 * @param {HTMLElement | null} root
 */
function clearFilterSelect(root) {
  const filterSelect = safeQuery(
    root,
    DOM_SELECTORS.PAGE_FILTER,
    HTMLSelectElement,
  );
  if (filterSelect) filterSelect.value = 'all';
}

/**
 * @param {string} [message]
 */
function buildDaAccessErrorPanel(message = DA_LOGIN_REQUIRED_MESSAGE) {
  const wrap = el('div', 'bulk-pp-da-access-error');
  wrap.append(
    el('h3', 'bulk-pp-da-access-error-title', 'Sign in required'),
    el('p', 'bulk-pp-da-access-error-lead', message),
  );
  return wrap;
}

async function initSdk() {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('DA SDK not available')), TIMING.SDK_TIMEOUT_MS);
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
    const [, matchedOrg, matchedSite] = appMatch;
    if (!org) org = matchedOrg;
    if (!site) site = matchedSite;
  }
  return { org, site, ref };
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function syncBrowseLocation(state) {
  const {
    org, site, ref, folderPath, pageScope,
  } = state;
  const params = new URLSearchParams(window.location.search);
  if (ref && ref !== 'main') params.set('ref', ref);
  else params.delete('ref');
  const normalized = normalizeFolderPath(folderPath);
  if (normalized) params.set('path', normalized);
  else params.delete('path');
  if (pageScope === 'tree') params.set('scope', 'tree');
  else params.delete('scope');
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
  writeBrowseLocation(org, site, ref, normalized, pageScope);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {boolean} workspaceLocked
 */
function buildPagesScopeControl(state, workspaceLocked) {
  const locked = workspaceLocked || state.contentLoading;
  const isTree = state.pageScope === 'tree';
  const wrap = el('div', 'bulk-pp-pages-scope-inline');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Page scope');

  const segment = el('div', 'bulk-pp-pages-scope-segment');
  const folderBtn = el('button', 'bulk-pp-pages-scope-segment-btn');
  folderBtn.type = 'button';
  folderBtn.textContent = 'This folder';
  folderBtn.disabled = locked;
  folderBtn.classList.toggle('bulk-pp-pages-scope-segment-btn-active', !isTree);
  folderBtn.setAttribute('aria-pressed', isTree ? 'false' : 'true');

  const treeBtn = el('button', 'bulk-pp-pages-scope-segment-btn');
  treeBtn.type = 'button';
  treeBtn.textContent = 'Include subfolders';
  treeBtn.disabled = locked;
  treeBtn.classList.toggle('bulk-pp-pages-scope-segment-btn-active', isTree);
  treeBtn.setAttribute('aria-pressed', isTree ? 'true' : 'false');

  folderBtn.addEventListener('click', () => {
    if (!locked && isTree) state.onToggleIncludeSubdirectories(false);
  });
  treeBtn.addEventListener('click', () => {
    if (!locked && !isTree) state.onToggleIncludeSubdirectories(true);
  });

  segment.append(folderBtn, treeBtn);
  wrap.append(segment);
  return wrap;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function buildPagesLocationMeta(state) {
  const meta = el('span', 'bulk-pp-pages-location-meta');
  meta.id = 'bulk-pp-page-count';
  const text = pagesLocationMetaText(state);
  if (state.pages.length === 0) {
    meta.classList.add('bulk-pp-pages-location-meta-empty');
  }
  meta.textContent = text;
  return meta;
}

/**
 * @param {string} title
 * @param {string | number} count
 * @param {string} [countId]
 * @param {'folders'|'pages'} [variant]
 */
function buildSectionHead(title, count, countId = '', variant = 'folders') {
  const head = el('div', 'bulk-pp-section-head');
  const titleWrap = el('div', 'bulk-pp-section-title-wrap');
  const icon = el(
    'span',
    `bulk-pp-section-icon bulk-pp-section-icon-${variant}`,
  );
  icon.setAttribute('aria-hidden', 'true');
  titleWrap.append(icon, el('h3', 'bulk-pp-section-title', title));
  const countEl = el('span', 'bulk-pp-section-count', String(count));
  if (countId) countEl.id = countId;
  head.append(titleWrap, countEl);
  return head;
}

const BREADCRUMB_FOLDER_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5h4.2L8 7h5.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"/></svg>';

function buildBreadcrumbCurrentLabel(text) {
  const current = el('span', 'bulk-pp-breadcrumb-current');
  const icon = el('span', 'bulk-pp-breadcrumb-current-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = BREADCRUMB_FOLDER_ICON;
  current.append(icon, el('span', 'bulk-pp-breadcrumb-current-text', text));
  setAccessibilityLabel(current, `Current folder: ${text}`);
  return current;
}

function buildBreadcrumb(folderPath, onNavigate, locked = false) {
  const nav = el('nav', 'bulk-pp-breadcrumb');
  nav.setAttribute('aria-label', 'Current folder');
  const normalized = normalizeFolderPath(folderPath);

  if (!normalized) {
    nav.append(buildBreadcrumbCurrentLabel('Site root'));
    return nav;
  }

  const rootBtn = el('button', 'bulk-pp-breadcrumb-segment bulk-pp-breadcrumb-root', 'Site root');
  rootBtn.type = 'button';
  rootBtn.disabled = locked;
  if (!locked) {
    setAccessibilityLabel(rootBtn, 'Go to site root');
    rootBtn.addEventListener('click', () => onNavigate(''));
  }
  nav.append(rootBtn);
  const segments = normalized.split('/').filter(Boolean);
  segments.forEach((segment, index) => {
    nav.append(el('span', 'bulk-pp-breadcrumb-sep', '›'));
    const path = segments.slice(0, index + 1).join('/');
    if (index === segments.length - 1) {
      nav.append(buildBreadcrumbCurrentLabel(segment));
    } else {
      const btn = el('button', 'bulk-pp-breadcrumb-segment', segment);
      btn.type = 'button';
      btn.disabled = locked;
      if (!locked) {
        setAccessibilityLabel(btn, `Navigate to ${segment}`);
        btn.addEventListener('click', () => onNavigate(path));
      }
      nav.append(btn);
    }
  });
  return nav;
}

function applyOperationWorkspaceReset(state) {
  clearPageWorkspaceAfterOperation(state);
  const root = /** @type {HTMLElement | null} */ (state.root);
  closeProgressModal(root);

  clearFilterSelect(root);
  clearInputValue(root, '#bulk-pp-page-search');
  clearInputValue(root, '#bulk-pp-folder-search');

  if (root) patchPagesFilterControls(root, state);

  patchPageSearchResults(
    root,
    state,
    { org: state.org, site: state.site, ref: state.ref },
    buildPageRow,
  );
  patchFolderSearchResults(root, state);
  syncSelectionUI(root, state);
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesFilterControls(root, state) {
  const filterSelect = safeQuery(
    root,
    DOM_SELECTORS.PAGE_FILTER,
    HTMLSelectElement,
  );
  if (!filterSelect) return;

  filterSelect.querySelectorAll('option').forEach((opt) => {
    if (!(opt instanceof HTMLOptionElement)) return;
    const baseLabel = PAGE_FILTERS.find(([v]) => v === opt.value)?.[1] || opt.textContent;
    opt.disabled = false;
    opt.textContent = baseLabel;
  });

  filterSelect.disabled = state.contentLoading
    || isStatusFetchBlocking(state)
    || isDeploymentStatusPending(state);

  const filterNote = root.querySelector('.bulk-pp-pages-filter-note');
  if (filterNote) filterNote.remove();
}

/**
 * Clears in-memory preview/publish indicators (checkbox off or folder change).
 * @param {ReturnType<typeof createAppState>} state
 */
function clearPagesStatusDisplay(state) {
  if (state.statusChecking) {
    persistCurrentPlatformStatus(state);
  }
  cancelStatusCheck(state, false);
  state.pageFilter = 'all';
  state.statusFetched = false;
  state.statusFetchedAt = null;
  state.statusFetchedFromCache = false;
  state.platformStatus = {};
  state.statusCheckFailed = false;
  state.statusError = null;
  state.statusPanelNote = null;
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesHeader(root, state) {
  const host = safeQuery(root, '.bulk-pp-pages-header');
  if (!host) return;
  host.replaceWith(
    buildPagesHeader(state, isStatusFetchBlocking(state)),
  );
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesStatusLoading(root, state) {
  patchPagesHeader(root, state);
  const host = safeQuery(root, '#bulk-pp-pages-status-loading');
  if (host) host.remove();
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function refreshDeploymentUi(state) {
  const root = /** @type {HTMLElement | null} */ (state.root);
  if (!root) return;
  const siteCtx = siteCtxFromState(state);
  patchPagesStatusProgressBar(root, state);
  syncStatusFetchLockUi(root, state);
  syncFirstSessionLockUi(root, state);
  patchPagesStatusSummary(root, state);
  patchPagesStatusNotice(root, state);
  patchPagesStatusLoading(root, state);
  patchPagesFilterControls(root, state);
  syncWorkspaceInteractivity(root, state);
  patchPageSearchResults(root, state, siteCtx, buildPageRow);
  syncSelectionUI(root, state);
}

/**
 * Compact last-updated label + refresh control for the unified header toolbar.
 * @param {ReturnType<typeof createAppState>} state
 */
function buildStatusActionInline(state) {
  const wrap = el('div', 'bulk-pp-pages-status-inline');
  const when = formatStatusFetchedAt(state.statusFetchedAt);
  const meta = el('span', 'bulk-pp-pages-status-inline-meta');
  if (!when) {
    meta.textContent = 'Status not loaded';
  } else if (state.statusFetchedFromCache) {
    meta.textContent = `Updated ${when} · cached`;
  } else {
    meta.textContent = `Updated ${when}`;
  }
  wrap.append(meta, buildRealtimeStatusButton(state));
  return wrap;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {boolean} workspaceLocked
 */
function buildPagesHeader(state, workspaceLocked) {
  const header = el('div', 'bulk-pp-pages-header');
  const bar = el('div', 'bulk-pp-pages-context-bar');

  const primary = el('div', 'bulk-pp-pages-context-primary');
  const breadcrumb = buildBreadcrumb(
    state.folderPath,
    (path) => state.onNavigate(path),
    workspaceLocked,
  );
  breadcrumb.classList.add('bulk-pp-pages-breadcrumb');
  primary.append(breadcrumb);

  if (state.pages.length > 0) {
    primary.append(buildPagesStatusSummary(state));
  }
  bar.append(primary);

  const toolbar = el('div', 'bulk-pp-pages-context-toolbar');
  const toolbarLeft = el('div', 'bulk-pp-pages-context-toolbar-left');
  toolbarLeft.append(
    buildPagesLocationMeta(state),
    buildPagesScopeControl(state, workspaceLocked),
  );
  toolbar.append(toolbarLeft);

  const toolbarRight = el('div', 'bulk-pp-pages-context-toolbar-right');
  if (state.pages.length > 0) {
    toolbarRight.append(buildStatusActionInline(state));
    if (state.statusChecking && !isDeploymentStatusPending(state)) {
      toolbarRight.append(el('span', 'bulk-pp-pages-status-hint', 'Updating…'));
    }
  } else {
    toolbarRight.append(
      el('p', 'bulk-pp-pages-context-empty', 'Open a folder with pages to see deployment status.'),
    );
  }
  toolbar.append(toolbarRight);
  bar.append(toolbar);
  header.append(bar);

  return header;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string[]} helixPaths
 */
function buildPagesStatusNotice(state) {
  if (state.statusPanelNote) {
    return el('p', 'bulk-pp-status-note', state.statusPanelNote);
  }
  if (state.statusCheckFailed && state.statusError && state.pages.length > 0) {
    const note = el(
      'p',
      'bulk-pp-status-note bulk-pp-status-note-error',
      formatStatusAccessMessage(state.statusError),
    );
    note.id = 'bulk-pp-pages-status-notice';
    note.setAttribute('role', 'alert');
    return note;
  }
  return null;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function siteCtxFromState(state) {
  return { org: state.org, site: state.site, ref: state.ref };
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function buildPagesStatusSummary(state) {
  if (isDeploymentStatusPending(state)) {
    return buildPagesStatusSummaryLoading();
  }
  const helixPaths = state.pages.map((p) => p.helixPath);
  const hasAnyStatus = helixPaths.some((path) => {
    const entry = state.platformStatus[path];
    return Boolean(entry?.previewedAt || entry?.publishedAt);
  });
  if (state.statusCheckFailed && state.statusError && !hasAnyStatus) {
    const strip = el(
      'div',
      'bulk-pp-pages-summary bulk-pp-pages-summary-error',
    );
    strip.id = 'bulk-pp-pages-summary';
    strip.setAttribute('aria-label', 'Deployment status unavailable');
    strip.append(
      el(
        'span',
        'bulk-pp-pages-summary-error-text',
        formatStatusAccessMessage(state.statusError),
      ),
    );
    return strip;
  }
  const {
    live, previewOnly, none, total,
  } = deploymentCountsForPaths(
    state.platformStatus,
    helixPaths,
  );
  const strip = el('div', 'bulk-pp-pages-summary');
  strip.id = 'bulk-pp-pages-summary';
  strip.setAttribute('aria-label', 'Deployment summary for pages in this view');

  /** @type {[string, number, string][]} */
  const items = [
    ['live', live, 'Published'],
    ['preview', previewOnly, 'Preview only'],
    ['none', none, 'Not deployed'],
    ['total', total, 'Total'],
  ];
  items.forEach(([mod, value, label]) => {
    const item = el(
      'div',
      `bulk-pp-pages-summary-item bulk-pp-pages-summary-${mod}`,
    );
    item.append(
      el('span', 'bulk-pp-pages-summary-value', String(value)),
      el('span', 'bulk-pp-pages-summary-label', label),
    );
    strip.append(item);
  });
  return strip;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string} pageFilter
 * @param {boolean} contentLoading
 * @returns {{ filterField: HTMLElement, filterSelect: HTMLSelectElement }}
 */
function buildPagesFilterField(state, pageFilter, contentLoading) {
  const filterField = el(
    'div',
    'bulk-pp-pages-filter-field bulk-pp-field-filter',
  );
  const filterSelect = document.createElement('select');
  filterSelect.id = DOM_IDS.PAGE_FILTER;
  filterSelect.className = 'bulk-pp-filter-select';
  filterSelect.setAttribute('aria-label', 'Filter by status');
  filterSelect.disabled = contentLoading;
  PAGE_FILTERS.forEach(([value, labelText]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = labelText;
    if (value === (pageFilter || 'all')) opt.selected = true;
    filterSelect.append(opt);
  });
  filterField.append(filterSelect);
  return { filterField, filterSelect };
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function buildRealtimeStatusButton(state) {
  const btn = el(
    'button',
    'bulk-pp-btn bulk-pp-btn-refresh-status bulk-pp-pages-refresh-status',
  );
  btn.type = 'button';
  btn.disabled = state.pages.length === 0
    || state.contentLoading
    || state.loading
    || state.statusChecking;
  setAccessibilityLabel(btn, 'Refresh deployment status');
  const icon = el('span', 'bulk-pp-btn-refresh-status-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.5 3.5v3.2h-3.2"/></svg>';
  btn.append(icon, el('span', 'bulk-pp-btn-refresh-status-label', 'Refresh status'));
  btn.addEventListener('click', () => {
    if (typeof state.onRefreshStatus === 'function') {
      state.onRefreshStatus();
    }
  });
  return btn;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function shouldShowStatusProgressBar(state) {
  return isStatusFetchLockingUi(state);
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function syncStatusFetchLockUi(root, state) {
  const locked = isStatusFetchLockingUi(state);
  root.classList.toggle('bulk-pp-status-fetch-active', locked);
  const busy = locked || isFirstSessionStatusPending(state);
  root.setAttribute('aria-busy', busy ? 'true' : 'false');
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function syncFirstSessionLockUi(root, state) {
  const locked = isFirstSessionStatusPending(state)
    && !state.contentLoading
    && !state.statusChecking;
  root.classList.toggle('bulk-pp-first-session-loading', locked);
  const overlay = root.querySelector('#bulk-pp-first-session-overlay');
  if (locked) {
    if (!overlay) root.append(buildFirstSessionFetchOverlay());
  } else if (overlay) {
    overlay.remove();
  }
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function buildPagesStatusProgressBar(state) {
  const bar = el('div', 'bulk-pp-pages-status-progress');
  bar.id = 'bulk-pp-pages-status-progress';

  const head = el('div', 'bulk-pp-pages-status-progress-head');
  head.append(
    el(
      'span',
      'bulk-pp-pages-status-progress-title',
      'Checking deployment status',
    ),
  );
  const stopBtn = el(
    'button',
    'bulk-pp-btn bulk-pp-btn-text bulk-pp-pages-status-progress-stop',
    'Cancel',
  );
  stopBtn.type = 'button';
  setAccessibilityLabel(stopBtn, 'Cancel deployment status fetch');
  stopBtn.addEventListener('click', () => state.onCancelStatus());
  head.append(stopBtn);
  bar.append(head);

  const track = el('div', 'bulk-pp-progress-track');
  const fill = el('div', 'bulk-pp-progress-fill');
  fill.id = 'bulk-pp-pages-status-progress-fill';
  track.append(fill);
  bar.append(track);

  const meta = el('div', 'bulk-pp-pages-status-progress-meta');
  const label = el('span', 'bulk-pp-pages-status-progress-label', 'Starting…');
  label.id = 'bulk-pp-pages-status-progress-label';
  const eta = el('span', 'bulk-pp-pages-status-progress-eta', '');
  eta.id = 'bulk-pp-pages-status-progress-eta';
  meta.append(label, eta);
  bar.append(meta);

  updatePagesStatusProgressBar(bar, state);
  return bar;
}

/**
 * @param {HTMLElement} bar
 * @param {ReturnType<typeof createAppState>} state
 */
function updatePagesStatusProgressBar(bar, state) {
  const done = state.statusProgressDone;
  const total = state.statusProgressTotal;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const fill = bar.querySelector('#bulk-pp-pages-status-progress-fill');
  if (fill instanceof HTMLElement) fill.style.width = `${pct}%`;
  const label = bar.querySelector('#bulk-pp-pages-status-progress-label');
  if (label) {
    label.textContent = total > 0 ? `${done} of ${total} pages checked (${pct}%)` : 'Starting…';
  }
  const eta = bar.querySelector('#bulk-pp-pages-status-progress-eta');
  if (eta) {
    const runtime = formatRuntimeStatusEta(
      state.statusFetchStartedAt,
      done,
      total,
    );
    eta.textContent = runtime || '';
  }
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesStatusProgressBar(root, state) {
  const pagesSection = root.querySelector('.bulk-pp-content-section-pages');
  if (!pagesSection) return;
  let bar = root.querySelector('#bulk-pp-pages-status-progress');
  const show = shouldShowStatusProgressBar(state);
  if (!show) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = buildPagesStatusProgressBar(state);
    pagesSection.insertBefore(bar, pagesSection.firstChild);
    return;
  }
  updatePagesStatusProgressBar(bar, state);
}

/**
 * @param {HTMLSelectElement | null} filterSelect
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function bindDeploymentFilterSelect(filterSelect, root, state) {
  const siteCtx = siteCtxFromState(state);
  filterSelect?.addEventListener('change', () => {
    if (!filterSelect || filterSelect.disabled) return;
    state.pageFilter = filterSelect.value;
    patchPageSearchResults(root, state, siteCtx, buildPageRow);
  });
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesStatusSummary(root, state) {
  const host = root.querySelector('#bulk-pp-pages-summary');
  if (!host || state.pages.length === 0) return;
  host.replaceWith(buildPagesStatusSummary(state));
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesStatusNotice(root, state) {
  const existing = root.querySelector('#bulk-pp-pages-status-notice');
  const next = buildPagesStatusNotice(state);
  if (existing && !next) {
    existing.remove();
    return;
  }
  if (!next) return;
  if (existing) {
    existing.replaceWith(next);
    return;
  }
  const controls = root.querySelector('.bulk-pp-pages-controls');
  if (controls) controls.prepend(next);
}

/**
 * @param {Record<string, { previewedAt?: number, publishedAt?: number }>} platformStatus
 * @param {string[]} helixPaths
 */
function deploymentCountsForPaths(platformStatus, helixPaths) {
  /** @type {Record<string, { previewedAt?: number, publishedAt?: number }>} */
  const statusMap = {};
  helixPaths.forEach((path) => {
    statusMap[path] = platformStatus[path] || {};
  });
  const pages = helixPaths.map((helixPath) => ({ helixPath }));
  const {
    live, preview, none, previewed, orphanedLive,
  } = countStatusBreakdown(statusMap, pages);
  return {
    live,
    orphanedLive,
    previewed,
    previewOnly: preview,
    none,
    total: helixPaths.length,
  };
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string[]} helixPaths
 * @param {Record<string, { previewedAt?: number, publishedAt?: number }>} platformStatus
 */
function buildContentLoadingPanel(isFirstLoad = false) {
  const loading = el('div', 'bulk-pp-content-loading');
  const inner = el('div', 'bulk-pp-content-loading-inner');
  const spinner = el('div', 'bulk-pp-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  inner.append(
    spinner,
    el('p', 'bulk-pp-content-loading-title', 'Loading content'),
    el(
      'p',
      'bulk-pp-content-loading-sub',
      isFirstLoad
        ? 'Reading folders, pages, and deployment status for this location.'
        : 'Refreshing the current folder…',
    ),
  );
  loading.append(inner);
  return loading;
}

function buildFirstSessionFetchOverlay() {
  const overlay = el('div', 'bulk-pp-first-session-overlay');
  overlay.id = 'bulk-pp-first-session-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'Loading deployment status');
  const inner = el('div', 'bulk-pp-first-session-overlay-inner');
  const spinner = el('div', 'bulk-pp-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  inner.append(
    spinner,
    el('p', 'bulk-pp-content-loading-title', 'Checking deployment status'),
    el(
      'p',
      'bulk-pp-content-loading-sub',
      'This runs once when you open a folder. You can continue browsing afterward.',
    ),
  );
  overlay.append(inner);
  return overlay;
}

function buildPagesStatusSummaryLoading() {
  const strip = el(
    'div',
    'bulk-pp-pages-summary bulk-pp-pages-summary-pending',
  );
  strip.id = 'bulk-pp-pages-summary';
  strip.setAttribute('aria-label', 'Deployment summary loading');
  strip.append(
    el('span', 'bulk-pp-pages-summary-pending-text', 'Fetching status…'),
  );
  return strip;
}

/**
 * @param {HTMLElement} root
 * @param {{ org: string, site: string, ref: string }} ctx
 */
function renderAppHeader(root, ctx) {
  const { org, site, ref } = ctx;
  const header = el('header', 'bulk-pp-header');
  const headerInner = el('div', 'bulk-pp-header-inner');
  const headerBrand = el('div', 'bulk-pp-header-brand');
  headerBrand.append(
    el(
      'span',
      'bulk-pp-header-eyebrow',
      'Adobe Experience Manager · Edge Delivery',
    ),
    el('h1', null, APP_TITLE),
    el('p', 'bulk-pp-header-desc', APP_DESCRIPTION),
  );
  const headerMeta = el('div', 'bulk-pp-header-meta');
  headerMeta.append(
    buildMetaBadge('Branch', ref, true),
    buildMetaBadge('Site', site, true),
    buildMetaBadge('Organization', org),
  );
  headerInner.append(headerBrand, headerMeta);
  header.append(headerInner);
  root.append(header);
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function render(root, state) {
  const listWrapBefore = document.getElementById('bulk-pp-page-list-scroll');
  const savedListScroll = listWrapBefore ? listWrapBefore.scrollTop : null;

  const {
    org,
    site,
    ref,
    folderPath,
    error,
    pageFilter,
    pageSearch,
    folderSearch,
    contentLoading,
  } = state;
  const siteCtx = { org, site, ref };

  const {
    visible: visiblePages,
    statusMap,
    browseFolder,
  } = getVisiblePages(state);
  const workspaceLocked = isStatusFetchBlocking(state);
  const safeFolder = resolveContentFolderPath(folderPath);
  const searchDraft = String(pageSearch || '').trim();
  const searchTooShort = searchDraft.length > 0 && searchDraft.length < SEARCH_MIN_LEN;

  root.replaceChildren();
  root.classList.add('bulk-pp-shell');
  syncStatusFetchLockUi(root, state);
  syncFirstSessionLockUi(root, state);
  renderAppHeader(root, { org, site, ref });

  const contentPanel = el(
    'section',
    'bulk-pp-panel bulk-pp-panel-content bulk-pp-panel-fill',
  );
  const contentHead = el('div', 'bulk-pp-panel-head');
  const contentHeadMain = el('div', 'bulk-pp-panel-head-main');
  contentHeadMain.append(
    el('h2', null, 'Site content'),
    el(
      'p',
      'bulk-pp-panel-head-desc',
      'Navigate directories and manage pages at the current folder level.',
    ),
  );
  contentHead.append(contentHeadMain);
  contentPanel.append(contentHead);
  const contentBody = el('div', 'bulk-pp-panel-body bulk-pp-content-body');

  if (contentLoading) {
    contentBody.append(buildContentLoadingPanel(state.firstSessionLoad));
  } else if (error) {
    if (isDaAccessError(error)) {
      contentBody.append(buildDaAccessErrorPanel(error));
    } else {
      contentBody.append(
        el('p', 'bulk-pp-list-empty bulk-pp-list-empty-error', error),
      );
    }
  } else {
    const workspace = el('div', 'bulk-pp-workspace');
    const contentGrid = el('div', 'bulk-pp-content-grid');

    const folderSection = el(
      'section',
      'bulk-pp-content-section bulk-pp-content-section-folders',
    );
    folderSection.append(
      buildSectionHead(
        'Directories',
        getFolderCountLabel(state),
        'bulk-pp-folder-count',
        'folders',
      ),
    );

    const folderSearchDisabled = workspaceLocked;
    const { wrap: folderSearchField, input: folderSearchInput } = buildSearchField(
      'bulk-pp-folder-search',
      'Search folders',
      String(folderSearch || ''),
      folderSearchDisabled,
      searchHintText(folderSearch),
    );
    const folderSearchRow = el('div', 'bulk-pp-search-row');
    folderSearchRow.append(folderSearchField);
    folderSection.append(folderSearchRow);

    const folderWrap = el(
      'div',
      'bulk-pp-list-wrap bulk-pp-list-wrap-folders bulk-pp-list-wrap-tree',
    );
    const folderTreeHost = el('div', 'bulk-pp-folder-tree-host');
    folderTreeHost.id = 'bulk-pp-folder-tree-host';
    renderFolderTree(
      folderTreeHost,
      state,
      (path) => state.onNavigate(path),
      workspaceLocked,
    );
    folderWrap.append(folderTreeHost);
    folderSection.append(folderWrap);
    contentGrid.append(folderSection);

    bindSearchInput(folderSearchInput, state, 'folder', () => {
      patchFolderSearchResults(root, state);
    });

    const pagesSection = el(
      'section',
      'bulk-pp-content-section bulk-pp-content-section-pages',
    );
    if (shouldShowStatusProgressBar(state)) {
      pagesSection.append(buildPagesStatusProgressBar(state));
    }

    const { filterField, filterSelect } = buildPagesFilterField(
      state,
      String(pageFilter || 'all'),
      state.contentLoading
        || workspaceLocked
        || isDeploymentStatusPending(state),
    );

    pagesSection.append(buildPagesHeader(state, workspaceLocked));

    const controls = el('div', 'bulk-pp-pages-controls');

    const toolbarRow = el('div', 'bulk-pp-pages-toolbar-row');
    const pageSearchDisabled = workspaceLocked || state.pages.length === 0;
    const { wrap: searchField, input: searchInput } = buildSearchField(
      'bulk-pp-page-search',
      'Search pages',
      String(pageSearch || ''),
      pageSearchDisabled,
      searchHintText(pageSearch),
    );
    searchField.classList.add('bulk-pp-pages-search-field');
    toolbarRow.append(searchField, filterField);

    controls.append(toolbarRow);

    const statusNotice = buildPagesStatusNotice(state);
    if (statusNotice) controls.append(statusNotice);

    pagesSection.append(controls);

    const pageWrap = el(
      'div',
      'bulk-pp-list-wrap bulk-pp-list-wrap-pages bulk-pp-list-wrap-fill',
    );
    pageWrap.id = 'bulk-pp-page-list-wrap';
    if (!isFirstSessionStatusPending(state)) {
      if (state.pages.length > 0) {
        pageWrap.append(buildPageListColumnHeader(state));
      }
      const pageList = el('ul', 'bulk-pp-list');
      pageList.id = 'bulk-pp-page-list';
      bindPageListSelection(pageList, state);
      if (state.pages.length === 0) {
        pageList.append(
          el('li', 'bulk-pp-list-empty', 'No pages in this location.'),
        );
      } else if (visiblePages.length === 0) {
        const emptyMsg = searchDraft
          ? 'No pages match this search.'
          : 'No pages match this filter.';
        pageList.append(el('li', 'bulk-pp-list-empty', emptyMsg));
      } else {
        visiblePages.forEach((page) => {
          pageList.append(
            buildPageRow(
              page,
              statusMap[page.helixPath],
              browseFolder,
              state,
              shouldShowPageStatus(state),
              siteCtx,
              workspaceLocked,
            ),
          );
        });
      }
      const listScroll = el('div', 'bulk-pp-page-list-scroll');
      listScroll.id = 'bulk-pp-page-list-scroll';
      listScroll.append(pageList);
      pageWrap.append(listScroll);
    }
    pagesSection.append(pageWrap);
    if (!isFirstSessionStatusPending(state)) {
      pagesSection.append(buildSelectionActionBar(state));
    }
    contentGrid.append(pagesSection);
    workspace.append(contentGrid);
    contentBody.append(workspace);

    bindDeploymentFilterSelect(filterSelect, root, state);
    bindSearchInput(searchInput, state, 'page', () => {
      patchPageSearchResults(root, state, siteCtx, buildPageRow);
    });
    syncSelectionUI(root, state);
  }
  contentPanel.append(contentBody);
  root.append(contentPanel);

  patchStatusBanner(root, state);

  requestAnimationFrame(() => {
    if (savedListScroll != null) {
      const listWrap = document.getElementById('bulk-pp-page-list-scroll');
      if (listWrap) listWrap.scrollTop = savedListScroll;
    }
  });
}

async function main() {
  const app = document.getElementById('app');
  if (!app) return;

  let { context, actions } = await initSdk();
  let hasSdkFetch = typeof actions.daFetch === 'function';
  const inDaAppShell = /\/app\/[^/]+\/[^/]+/.test(window.location.pathname);
  // DA SDK can occasionally arrive a moment late on the first load.
  if (!hasSdkFetch && inDaAppShell) {
    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });
    const retry = await initSdk();
    if (typeof retry.actions?.daFetch === 'function') {
      context = retry.context;
      actions = retry.actions;
      hasSdkFetch = true;
    }
  }
  const daFetch = hasSdkFetch ? wrapDaFetch(actions.daFetch) : null;
  const ctx = resolveSiteContext(context);

  const state = createAppState(ctx);
  state.root = app;
  resetWorkspace(state);
  configureAppHooks({
    render,
    refreshDeploymentUi,
    applyOperationWorkspaceReset,
    patchStatusBanner,
  });
  const urlParams = new URLSearchParams(window.location.search);
  const urlRef = urlParams.get('ref');
  if (urlRef) state.ref = urlRef;
  const urlPath = urlParams.get('path');
  const urlScope = urlParams.get('scope');
  const persisted = readBrowseLocation(ctx.org, ctx.site, state.ref);
  if (urlPath) {
    state.folderPath = resolveContentFolderPath(normalizeFolderPath(urlPath));
  } else if (persisted?.folderPath) {
    state.folderPath = resolveContentFolderPath(persisted.folderPath);
  }
  if (urlScope === 'tree' || urlScope === 'folder') {
    state.pageScope = urlScope;
  } else if (persisted?.pageScope) {
    state.pageScope = persisted.pageScope;
  }
  syncBrowseLocation(state);

  state.onCancelStatus = () => {
    const checked = state.statusProgressDone;
    const total = state.statusProgressTotal;
    cancelStatusCheck(state, false);
    state.statusChecking = false;
    state.statusFetchBackground = false;
    if (checked > 0) {
      persistCurrentPlatformStatus(state);
      state.statusFetched = true;
      markInitialStatusFetchComplete(state);
      state.statusPanelNote = `Stopped after ${checked} of ${total} pages. Showing partial results.`;
    } else {
      state.statusFetched = false;
      markInitialStatusFetchComplete(state);
      state.statusPanelNote = 'Status check stopped.';
    }
    const root = /** @type {HTMLElement | null} */ (state.root);
    state.statusPanelNote = checked > 0
      ? `Stopped after ${checked} of ${total} pages. Partial results are shown.`
      : 'Status check cancelled.';
    if (root) patchOrRender(state);
  };

  state.onRefreshStatus = () => {
    if (!daFetch || state.contentLoading || state.loading || state.pages.length === 0) {
      return;
    }
    if (state.statusChecking) {
      return;
    }
    const location = displayFolderPath(state.folderPath) || 'site root';
    const helixPaths = state.pages.map((p) => p.helixPath);
    startStatusCheck(
      state,
      daFetch,
      helixPaths,
      location,
      state.pages.length,
      state.folders.length,
      { forceRefresh: true },
    );
  };

  state.onCancelJob = () => {
    cancelBulkJob(state, false);
    if (app) syncSelectionUI(app, state);
    const topic = /** @type {JobTopic} */ (state.jobTopic || 'preview');
    const actionLabel = jobActionLabel(topic);
    showJobCancelledModal({
      message: `You stopped tracking this bulk ${actionLabel} operation. If it already started on the server, work may still be in progress. Refresh deployment status to see the latest state.`,
      topic,
      onClose: () => {
        state.status = null;
        state.statusType = 'info';
        finishProgressModal(state);
      },
    });
  };

  state.onNavigate = async (targetPath) => {
    if (state.contentLoading) return;
    closeProgressModal(/** @type {HTMLElement} */ (app));
    resetPagesViewState(state);
    clearPagesStatusDisplay(state);

    state.folderPath = resolveContentFolderPath(targetPath);
    expandFolderAncestors(state, targetPath);
    state.pageSearch = '';
    state.folderSearch = '';
    state.pageFilter = 'all';
    syncBrowseLocation(state);
    await state.onFetch(true);
  };

  state.onExpandFolder = async (folderPath, expand) => {
    if (isStatusFetchBlocking(state) || state.contentLoading) return;
    const key = normalizeFolderPath(folderPath);
    if (!expand) {
      state.expandedFolders.delete(key);
    } else {
      state.expandedFolders.add(key);
      if (!state.folderTreeCache[key]) {
        await loadFolderTreeChildren(state, daFetch, key);
      }
    }
    const rootEl = /** @type {HTMLElement | null} */ (state.root);
    if (rootEl) {
      patchFolderTree(
        rootEl,
        state,
        (path) => state.onNavigate(path),
        isStatusFetchBlocking(state),
      );
    }
  };

  state.onToggleIncludeSubdirectories = async (enabled) => {
    if (isStatusFetchBlocking(state) || state.contentLoading) return;
    const next = enabled ? 'tree' : 'folder';
    if (state.pageScope === next) return;
    closeProgressModal(/** @type {HTMLElement} */ (app));
    state.pageScope = next;
    clearPagesStatusDisplay(state);
    syncBrowseLocation(state);
    await state.onFetch(true);
  };

  state.onFetch = async (fromFolderNav = false) => {
    if (state.statusChecking) {
      persistCurrentPlatformStatus(state);
      cancelStatusCheck(state, false);
      state.statusChecking = false;
    }

    if (!fromFolderNav) {
      state.pageFilter = 'all';
      state.pageSearch = '';
      state.folderSearch = '';
      state.selected.clear();
    }

    if (!state.org || !state.site) {
      state.error = `Missing org or site in DA context. ${DA_SITE_CONTEXT_MESSAGE}`;
      render(app, state);
      return;
    }

    syncBrowseLocation(state);
    cancelStatusCheck(state, false);
    state.contentLoading = true;
    state.error = null;
    state.statusCancelled = false;
    state.statusFetched = false;
    state.platformStatus = {};
    state.statusCheckFailed = false;
    state.statusError = null;
    state.statusPanelNote = null;
    state.status = null;
    state.statusType = 'info';
    render(app, state);

    try {
      const isFirstWorkspaceLoad = !state.initialContentLoaded;
      const browseEntries = await listFolderEntries(
        daFetch,
        state.org,
        state.site,
        state.folderPath,
      );
      state.folders = browseEntries.filter((e) => e.kind === 'folder');
      seedFolderTreeCache(state, state.folderPath, state.folders);
      expandFolderAncestors(state, state.folderPath);
      await hydrateFolderTreeToPath(state, daFetch, state.folderPath);

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
      const docCount = state.pages.length;
      const location = displayFolderPath(state.folderPath) || 'site root';
      state.initialContentLoaded = true;
      if (!isFirstWorkspaceLoad) {
        state.contentLoading = false;
      }

      if (docCount > 0) {
        const helixPaths = state.pages.map((p) => p.helixPath);
        startStatusCheck(
          state,
          daFetch,
          helixPaths,
          location,
          docCount,
          state.folders.length,
          {
            cacheOnly: false,
            background: false,
          },
        );
        render(app, state);
      } else {
        finishContentLoadWithoutStatus(
          state,
          location,
          docCount,
          state.folders.length,
        );
      }
    } catch (err) {
      state.folders = [];
      state.pages = [];
      state.selected.clear();
      state.contentLoading = false;
      state.error = messageFromApiError(err, 'Failed to load content.', 'list');
      state.status = state.error;
      state.statusType = 'error';
      render(app, state);
    }
  };

  state.onSelectAll = (checked) => {
    selectAllVisible(state, checked);
    const { root } = state;
    if (!root) return;
    if (root.querySelector('#bulk-pp-page-list')) {
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
    const { root } = state;
    if (!root) return;
    syncSelectionUI(root, state);
  };

  bindJobRunHandlers(state, app, daFetch);

  if (!daFetch) {
    state.error = DA_LOGIN_REQUIRED_MESSAGE;
    state.status = null;
    state.statusType = 'info';
    render(app, state);
    return;
  }

  if (!ctx.org || !ctx.site) {
    state.error = DA_SITE_CONTEXT_MESSAGE;
    state.status = null;
    state.statusType = 'info';
    render(app, state);
    return;
  }

  state.contentLoading = true;
  state.status = null;
  state.statusType = 'info';
  render(app, state);
  await state.onFetch(false);
}

function showBootError(err) {
  const app = document.getElementById('app');
  if (!app) return;
  const message = err instanceof Error ? err.message : String(err);
  app.replaceChildren();
  const panel = el('div', 'bulk-pp-boot-error');
  panel.append(
    el('h1', null, `${APP_TITLE} failed to start`),
    el('p', null, message),
    el(
      'p',
      'bulk-pp-boot-error-hint',
      'Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows). If this persists, check the browser console for the failing module.',
    ),
  );
  app.append(panel);
}

main().catch(showBootError);
