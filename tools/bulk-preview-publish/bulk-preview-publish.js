import {
  collectPages,
  deleteDaDocumentsSequential,
  fetchPlatformStatusForPaths,
  wrapDaFetch,
  messageFromApiError,
  permissionErrorHint,
  getJobPollUrl,
  listFolderEntries,
  pollJob,
  resolveJobOutcome,
  runBulkRemoveJob,
  startBulkJob,
  DA_LOGIN_REQUIRED_MESSAGE,
  DA_SITE_CONTEXT_MESSAGE,
  isDaAccessError,
} from './lib/api.js';
import {
  displayFolderPath,
  formatPageListLabel,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js';
import {
  buildOptimisticStatusPatch,
  commitPlatformStatus,
  getUncachedHelixPaths,
  hasCompleteCachedStatus,
  hydratePlatformStatusFromCache,
  persistCurrentPlatformStatus,
  removePathsFromStatusCache,
} from './lib/status-cache.js';
import {
  buildDaEditUrl,
  buildSiteHost,
  buildUrlsForPaths,
} from './lib/urls.js';
import {
  formatStatusDate,
  getPageStatus,
  PAGE_FILTERS,
  countStatusBreakdown,
  statusLabel,
} from './lib/page-history.js';
import {
  confirmBulkRun,
  confirmDestructiveAction,
  confirmOpenUrlsInNewTabs,
} from './lib/modal.js';
import {
  openUrlsInNewTabsQuiet,
  shouldWarnPopupBlock,
} from './lib/ui-utils.js';
import {
  closeJobModal,
  closeProgressModal,
  isJobModalOpen,
  isProgressModalOpen,
  openJobModal,
  showJobCancelledModal,
  showJobCompleteModal,
  showJobErrorModal,
  updateJobModal,
} from './lib/progress-modal.js';
import { formatRuntimeStatusEta } from './lib/status-estimate.js';
import {
  bindSearchInput,
  buildSearchField,
  patchFolderSearchResults,
  patchPageSearchResults,
  searchHintText,
  syncSelectionUI,
} from './lib/search-ui.js';
import {
  cancelBulkJob,
  cancelStatusCheck,
  cancelStatusRevalidate,
  clearPageWorkspaceAfterOperation,
  createAppState,
  formatSelectionPillText,
  getActiveSelectionCount,
  getSelectedHelixPaths,
  getVisiblePages,
  getVisibleFolders,
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
import { el } from './lib/dom.js';

/** @typedef {'preview'|'live'|'unpreview'|'unpublish'|'delete'} JobTopic */

/**
 * @param {JobTopic | null | undefined} topic
 */
function jobActionLabel(topic) {
  if (topic === 'delete') return 'delete';
  if (topic === 'unpublish') return 'unpublish';
  if (topic === 'unpreview') return 'unpreview';
  if (topic === 'live') return 'publish';
  return 'preview';
}

/**
 * @param {'unpreview'|'unpublish'|'delete'} action
 * @param {number} count
 */
function destructiveStartMessage(action, count) {
  const noun = count === 1 ? 'page' : 'pages';
  if (action === 'delete') return `Starting delete for ${count} ${noun}…`;
  if (action === 'unpublish') return `Starting unpublish for ${count} ${noun}…`;
  return `Starting unpreview for ${count} ${noun}…`;
}

/** @type {Record<'untouched'|'previewed'|'published', string>} */
const STATUS_COLOR = {
  untouched: '#c9252d',
  previewed: '#c9940a',
  published: '#2d8a4e',
};

const SDK_URL = 'https://da.live/nx/utils/sdk.js';
const SDK_TIMEOUT_MS = 8000;

const APP_TITLE = 'Content Operations Hub';
const APP_DESCRIPTION = 'Browse folders, select pages, and run bulk preview, publish, or removal at the current directory level.';

/** @typedef {import('./lib/state.js').PageOperationId} PageOperationId */

/** @type {{ id: PageOperationId, label: string, variant: 'deploy' | 'primary' }[]} */
const SELECTION_STRIP_OPS = [
  { id: 'preview', label: 'Preview', variant: 'deploy' },
  { id: 'live', label: 'Publish', variant: 'primary' },
];

/** @type {{ id: PageOperationId, label: string, danger?: boolean }[]} */
const MORE_SELECTION_ITEMS = [
  { id: 'unpreview', label: 'Remove from preview' },
  { id: 'unpublish', label: 'Remove from publish' },
  { id: 'delete', label: 'Delete from DA', danger: true },
  { id: 'open-da', label: 'Open in DA' },
  { id: 'open-preview', label: 'Open preview URLs (.page)' },
  { id: 'open-live', label: 'Open publish URLs (.live)' },
];

/** @type {Record<string, string>} */
const SELECTION_OP_ICONS = {
  preview: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8s2.2-4 5.5-4 5.5 4 5.5 4-2.2 4-5.5 4-5.5-4-5.5-4Z"/><circle cx="8" cy="8" r="1.75"/></svg>',
  live: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V3.5M5 6.5 8 3.5 11 6.5"/><path d="M3.5 12.5h9"/></svg>',
  unpreview: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l10 10M6.2 6.2A3.5 3.5 0 0 0 8 11.5a3.5 3.5 0 0 0 1.8-.5"/><path d="M2.5 8s2.2-4 5.5-4c.7 0 1.3.1 1.8.3"/></svg>',
  unpublish: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 11h11M5 11V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V11"/><path d="M6.5 8h3"/></svg>',
  delete: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4.5h9M6 4.5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5.5 4.5l.5 8.5a1 1 0 0 0 1 .9h2a1 1 0 0 0 1-.9l.5-8.5"/></svg>',
  'open-da': '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6.5L9.5 2.5Z"/><path d="M9.5 2.5V6.5H13M6 9.5h4M6 11.5h2.5"/></svg>',
  'open-preview': '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5a8 8 0 0 1 0 11M8 2.5a8 8 0 0 0 0 11"/></svg>',
  'open-live': '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5l1.6 3.2 3.6.5-2.6 2.5.6 3.6L8 10.4l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5L8 2.5Z"/></svg>',
  more: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12" cy="8" r="1"/></svg>',
};

/**
 * @param {string} operationId
 */
function buildSelectionOpIcon(operationId) {
  const icon = el('span', 'bulk-pp-selection-op-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = SELECTION_OP_ICONS[operationId] || '';
  return icon;
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

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {boolean} workspaceLocked
 */
function buildPagesSectionHead(state, workspaceLocked) {
  const head = el('div', 'bulk-pp-section-head');
  const titleWrap = el('div', 'bulk-pp-section-title-wrap');
  const icon = el('span', 'bulk-pp-section-icon bulk-pp-section-icon-pages');
  icon.setAttribute('aria-hidden', 'true');
  titleWrap.append(icon, el('h3', 'bulk-pp-section-title', 'Pages'));
  head.append(titleWrap);
  return head;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {boolean} workspaceLocked
 */
function buildPagesScopeRow(state, workspaceLocked) {
  const locked = workspaceLocked || state.contentLoading;
  const scopeRow = el('div', 'bulk-pp-pages-scope-row');
  const scopeCheck = el('input');
  scopeCheck.type = 'checkbox';
  scopeCheck.id = 'bulk-pp-include-subdirectories';
  scopeCheck.checked = state.pageScope === 'tree';
  scopeCheck.disabled = locked;
  scopeCheck.addEventListener('change', () => {
    void state.onToggleIncludeSubdirectories(scopeCheck.checked);
  });
  const scopeLabel = el('label', 'bulk-pp-pages-scope-check');
  scopeLabel.htmlFor = 'bulk-pp-include-subdirectories';
  scopeLabel.append(
    scopeCheck,
    document.createTextNode(' Include all subdirectories'),
  );
  scopeRow.append(scopeLabel);
  return scopeRow;
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
  const icon = el('span', `bulk-pp-section-icon bulk-pp-section-icon-${variant}`);
  icon.setAttribute('aria-hidden', 'true');
  titleWrap.append(icon, el('h3', 'bulk-pp-section-title', title));
  const countEl = el('span', 'bulk-pp-section-count', String(count));
  if (countId) countEl.id = countId;
  head.append(titleWrap, countEl);
  return head;
}

function buildBreadcrumb(folderPath, onNavigate, locked = false) {
  const nav = el('nav', 'bulk-pp-breadcrumb');
  nav.setAttribute('aria-label', 'Current folder');
  const normalized = normalizeFolderPath(folderPath);

  if (!normalized) {
    nav.append(el('span', 'bulk-pp-breadcrumb-current', 'Site root'));
    return nav;
  }

  const rootBtn = el('button', 'bulk-pp-breadcrumb-segment', 'Site root');
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

function formatRowModifiedLabel(entry, showStatus) {
  if (!showStatus || !entry) return '';
  const ts = Math.max(entry.previewedAt || 0, entry.publishedAt || 0);
  return ts ? formatStatusDate(ts) : '';
}

function buildPageListColumnHeader() {
  const head = el('div', 'bulk-pp-list-colhead bulk-pp-list-colhead-pages');
  head.setAttribute('aria-hidden', 'true');
  head.append(
    el('span', 'bulk-pp-list-colhead-check'),
    el('span', 'bulk-pp-list-colhead-icon'),
    el('span', 'bulk-pp-list-colhead-name', 'Name'),
    el('span', 'bulk-pp-list-colhead-modified', 'Modified'),
    el('span', 'bulk-pp-list-colhead-actions'),
  );
  return head;
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
  cb.checked = state.selected.has(page.helixPath);
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
  const { title } = formatPageListLabel(page.helixPath, page.name, browseFolder);
  const labelWrap = el('div', 'bulk-pp-item-main');
  const label = document.createElement('label');
  label.htmlFor = cb.id;
  label.className = 'bulk-pp-item-label';
  label.textContent = title;
  labelWrap.append(label);

  const modifiedText = formatRowModifiedLabel(entry, showStatus);
  const modifiedEl = el('span', 'bulk-pp-item-modified', modifiedText);
  if (!modifiedText) modifiedEl.setAttribute('aria-hidden', 'true');

  const rowActions = el('div', 'bulk-pp-row-actions');
  const daUrl = buildDaEditUrl(siteCtx.org, siteCtx.site, page.helixPath, page.sourcePath, siteCtx.ref);
  const multiSelected = getActiveSelectionCount(state) > 1;
  const daDisabled = interactionsLocked || multiSelected;
  const daLink = document.createElement('a');
  daLink.className = 'bulk-pp-btn bulk-pp-btn-open-da';
  daLink.dataset.href = daUrl;
  if (daDisabled) {
    daLink.classList.add('bulk-pp-btn-open-da-disabled');
    daLink.setAttribute('aria-disabled', 'true');
    daLink.title = multiSelected
      ? 'Use More → Open in DA when multiple pages are selected'
      : 'Unavailable while status is loading';
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
    daLink.title = 'Open this page in Document Authoring';
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
  li.append(cb, icon, labelWrap, modifiedEl, rowActions);
  return li;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {'preview'|'live'} env
 * @returns {string[]}
 */
function collectDeployedHelixPaths(state, env) {
  return state.pages
    .map((p) => p.helixPath)
    .filter((helixPath) => {
      const entry = state.platformStatus[helixPath];
      if (env === 'live') return Boolean(entry?.publishedAt);
      return Boolean(entry?.previewedAt);
    });
}

/**
 * @param {string[]} urls
 * @param {ReturnType<typeof createAppState>} [state]
 */
async function openUrlsInNewTabs(urls, state = null) {
  if (urls.length === 0) return;
  const ok = await confirmOpenUrlsInNewTabs(urls.length);
  if (!ok) return;
  if (state) {
    applyOperationWorkspaceReset(state);
  }
  const result = openUrlsInNewTabsQuiet(urls);
  if (shouldWarnPopupBlock(result) && state) {
    state.status = 'Your browser blocked new tabs. Allow pop-ups for this site, or copy URLs from the operation completion dialog.';
    state.statusType = 'error';
    if (state.root) render(/** @type {HTMLElement} */ (state.root), state);
  }
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {'preview'|'live'} env
 * @param {string[]} paths
 */
async function openEnvUrls(state, env, paths) {
  if (paths.length === 0) return;
  await openUrlsInNewTabs(
    buildUrlsForPaths(paths, state.org, state.site, state.ref, env),
    state,
  );
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {'preview'|'live'} env
 */
async function openSelectedUrls(state, env) {
  await openEnvUrls(state, env, getSelectedHelixPaths(state));
}

async function openSelectedDa(state) {
  const pageByPath = new Map(state.pages.map((p) => [p.helixPath, p]));
  const urls = getSelectedHelixPaths(state)
    .map((path) => pageByPath.get(path))
    .filter(Boolean)
    .map((page) => buildDaEditUrl(
      state.org,
      state.site,
      page.helixPath,
      page.sourcePath,
      state.ref,
    ));
  await openUrlsInNewTabs(urls, state);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @returns {boolean}
 */
function isOperationBlocked(state) {
  return state.loading
    || state.contentLoading
    || isStatusFetchBlocking(state)
    || isJobModalOpen()
    || getActiveSelectionCount(state) === 0;
}

/**
 * @param {PageOperationId} operationId
 * @returns {import('./lib/api.js').AdminOperation | ''}
 */
function operationApiKey(operationId) {
  if (operationId === 'live') return 'live';
  if (operationId === 'preview') return 'preview';
  if (operationId === 'unpreview') return 'unpreview';
  if (operationId === 'unpublish') return 'unpublish';
  if (operationId === 'delete') return 'delete';
  return '';
}

/**
 * @param {unknown} err
 * @param {string} message
 * @returns {string}
 */
function errorHintFrom(err, message) {
  const status = err && typeof err === 'object' && 'status' in err
    ? Number(/** @type {{ status?: number }} */ (err).status)
    : 0;
  return permissionErrorHint(status, message);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {JobTopic} topic
 * @param {unknown} err
 * @param {import('./lib/api.js').AdminOperation | ''} [operation]
 */
function presentJobError(state, topic, err, operation = '') {
  const msg = messageFromApiError(err, 'Operation failed.', operation);
  state.status = msg;
  state.statusType = 'error';
  if (err && typeof err === 'object' && 'data' in err && err.data) {
    state.jobDetail = JSON.stringify(err.data, null, 2);
  }
  showJobErrorModal({
    message: msg,
    topic,
    hint: errorHintFrom(err, msg),
    onClose: () => finishProgressModal(state),
  });
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {PageOperationId} operationId
 */
async function runPageOperation(state, operationId) {
  if (isOperationBlocked(state)) return;

  try {
    if (operationId === 'preview' || operationId === 'live') {
      await state.onRun(operationId);
      return;
    }
    if (operationId === 'unpreview' || operationId === 'unpublish' || operationId === 'delete') {
      await state.onRunDestructive(operationId);
      return;
    }
    if (operationId === 'open-da') {
      await openSelectedDa(state);
      return;
    }
    if (operationId === 'open-preview') {
      await openSelectedUrls(state, 'preview');
      return;
    }
    if (operationId === 'open-live') {
      await openSelectedUrls(state, 'live');
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    const op = operationApiKey(operationId);
    const msg = messageFromApiError(err, 'Operation failed.', op);
    state.status = msg;
    state.statusType = 'error';
    const root = state.root;
    if (root) render(/** @type {HTMLElement} */ (root), state);
  }
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @returns {boolean}
 */
function isSelectionActionsBlocked(state) {
  return state.loading
    || state.contentLoading
    || isStatusFetchBlocking(state)
    || isJobModalOpen();
}

/**
 * @param {HTMLButtonElement} btn
 * @param {ReturnType<typeof createAppState>} state
 * @param {PageOperationId} operationId
 */
/**
 * @param {HTMLButtonElement} btn
 * @param {ReturnType<typeof createAppState>} state
 * @param {PageOperationId} operationId
 * @param {string} label
 * @param {'default' | 'deploy' | 'primary'} [variant]
 */
function bindSelectionOpButton(btn, state, operationId, label, variant = 'default') {
  btn.type = 'button';
  btn.dataset.operation = operationId;
  btn.classList.add('bulk-pp-selection-strip-btn', `bulk-pp-selection-strip-btn-${variant}`);
  if (operationId === 'delete') btn.classList.add('bulk-pp-selection-strip-btn-danger');
  btn.append(
    buildSelectionOpIcon(operationId),
    el('span', 'bulk-pp-selection-op-label', label),
  );
  btn.addEventListener('click', () => {
    void runPageOperation(state, operationId);
  });
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function buildSelectionActionBar(state) {
  const count = getActiveSelectionCount(state);
  const blocked = isSelectionActionsBlocked(state);
  const anchor = el('div', 'bulk-pp-selection-strip-anchor');
  anchor.id = 'bulk-pp-selection-bar';
  if (count === 0) anchor.hidden = true;

  const bar = el('div', 'bulk-pp-selection-strip');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Actions for selected pages');

  const left = el('div', 'bulk-pp-selection-strip-left');
  const badge = el('div', 'bulk-pp-selection-strip-badge');
  const countEl = el('span', 'bulk-pp-selection-count', '');
  countEl.id = 'bulk-pp-selection-count';
  countEl.textContent = formatSelectionBarText(count);
  badge.append(countEl);

  const clearBtn = el('button', 'bulk-pp-selection-clear', 'Clear');
  clearBtn.type = 'button';
  clearBtn.id = 'bulk-pp-selection-clear';
  clearBtn.setAttribute('aria-label', 'Clear selection');
  clearBtn.title = 'Clear selection';
  clearBtn.disabled = blocked;
  clearBtn.addEventListener('click', () => state.onSelectAll(false));
  left.append(badge, clearBtn);

  const actions = el('div', 'bulk-pp-selection-strip-actions');
  const deployGroup = el('div', 'bulk-pp-selection-strip-group bulk-pp-selection-strip-group-deploy');
  SELECTION_STRIP_OPS.forEach(({ id, label, variant }) => {
    const btn = el('button');
    bindSelectionOpButton(btn, state, id, label, variant);
    btn.disabled = blocked;
    deployGroup.append(btn);
  });
  actions.append(deployGroup);

  const moreWrap = el('div', 'bulk-pp-selection-more-wrap');
  const moreBtn = el('button', 'bulk-pp-selection-strip-btn bulk-pp-selection-more-trigger');
  moreBtn.type = 'button';
  moreBtn.id = 'bulk-pp-selection-more';
  moreBtn.setAttribute('aria-haspopup', 'true');
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.disabled = blocked;
  moreBtn.append(el('span', 'bulk-pp-selection-op-label', 'More'));

  const menu = el('div', 'bulk-pp-selection-more-menu');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'More page operations');
  const menuPanel = el('div', 'bulk-pp-selection-more-menu-panel');
  MORE_SELECTION_ITEMS.forEach(({ id, label, danger }) => {
    const item = el('button', 'bulk-pp-selection-more-item');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    if (danger) item.classList.add('bulk-pp-selection-more-item-danger');
    item.disabled = blocked;
    item.append(buildSelectionOpIcon(id), el('span', 'bulk-pp-selection-more-item-label', label));
    item.addEventListener('click', () => {
      void runPageOperation(state, id);
      moreBtn.setAttribute('aria-expanded', 'false');
      menu.classList.remove('bulk-pp-selection-more-menu-open');
    });
    menuPanel.append(item);
  });
  menu.append(menuPanel);

  let moreHoverCloseTimer = null;
  const openMoreMenu = () => {
    if (moreHoverCloseTimer) {
      clearTimeout(moreHoverCloseTimer);
      moreHoverCloseTimer = null;
    }
    menu.classList.add('bulk-pp-selection-more-menu-open');
    moreBtn.setAttribute('aria-expanded', 'true');
  };
  const scheduleCloseMoreMenu = () => {
    if (moreHoverCloseTimer) clearTimeout(moreHoverCloseTimer);
    moreHoverCloseTimer = setTimeout(() => {
      menu.classList.remove('bulk-pp-selection-more-menu-open');
      moreBtn.setAttribute('aria-expanded', 'false');
      moreHoverCloseTimer = null;
    }, 220);
  };

  moreWrap.addEventListener('mouseenter', openMoreMenu);
  moreWrap.addEventListener('mouseleave', scheduleCloseMoreMenu);
  moreWrap.addEventListener('focusin', openMoreMenu);
  moreWrap.addEventListener('focusout', (e) => {
    if (!moreWrap.contains(/** @type {Node} */ (e.relatedTarget))) {
      scheduleCloseMoreMenu();
    }
  });

  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('bulk-pp-selection-more-menu-open')) {
      menu.classList.remove('bulk-pp-selection-more-menu-open');
      moreBtn.setAttribute('aria-expanded', 'false');
    } else {
      openMoreMenu();
    }
  });

  moreWrap.append(moreBtn, menu);
  actions.append(el('div', 'bulk-pp-selection-strip-divider'), moreWrap);
  bar.append(left, actions);
  anchor.append(bar);
  return anchor;
}

/**
 * @param {number} count
 */
function formatSelectionBarText(count) {
  return count === 1 ? '1 page selected' : `${count} pages selected`;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function applyOperationWorkspaceReset(state) {
  clearPageWorkspaceAfterOperation(state);
  clearPagesStatusDisplay(state);
  const root = /** @type {HTMLElement | null} */ (state.root);
  closeProgressModal(root);
  if (!root) return;

  const filterSelect = root.querySelector('#bulk-pp-page-filter');
  if (filterSelect instanceof HTMLSelectElement) {
    filterSelect.value = 'all';
    patchPagesFilterControls(root, state);
  }

  const pageSearchInput = root.querySelector('#bulk-pp-page-search');
  if (pageSearchInput instanceof HTMLInputElement) pageSearchInput.value = '';

  const folderSearchInput = root.querySelector('#bulk-pp-folder-search');
  if (folderSearchInput instanceof HTMLInputElement) folderSearchInput.value = '';

  patchPageSearchResults(
    root,
    state,
    { org: state.org, site: state.site, ref: state.ref },
    buildPageRow,
  );
  patchFolderSearchResults(root, state, buildFolderRow);
  syncSelectionUI(root, state);
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesFilterControls(root, state) {
  const filterSelect = root.querySelector('#bulk-pp-page-filter');
  if (!(filterSelect instanceof HTMLSelectElement)) return;

  filterSelect.querySelectorAll('option').forEach((opt) => {
    if (!(opt instanceof HTMLOptionElement)) return;
    const baseLabel = PAGE_FILTERS.find(([v]) => v === opt.value)?.[1] || opt.textContent;
    opt.disabled = false;
    opt.textContent = baseLabel;
  });

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
    cancelStatusCheck(state, false);
    state.statusChecking = false;
  }
  state.pageFilter = 'all';
  state.statusFetched = false;
  state.platformStatus = {};
  state.statusCheckFailed = false;
  state.statusError = null;
  state.statusPanelNote = null;
  resetFetchStatusOption(state);
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesHeader(root, state) {
  const host = root.querySelector('.bulk-pp-pages-header');
  if (!host) return;
  host.replaceWith(buildPagesHeader(state, isStatusFetchBlocking(state)));
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchPagesStatusLoading(root, state) {
  patchPagesHeader(root, state);
  const host = root.querySelector('#bulk-pp-pages-status-loading');
  if (host) host.remove();
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function refreshDeploymentUi(state) {
  const root = /** @type {HTMLElement | null} */ (state.root);
  if (!root) return;
  patchPagesStatusProgressBar(root, state);
  syncStatusFetchLockUi(root, state);
  syncFirstSessionLockUi(root, state);
  patchPagesStatusSummary(root, state);
  patchPagesStatusLoading(root, state);
  patchPagesFilterControls(root, state);
  patchPageSearchResults(
    root,
    state,
    { org: state.org, site: state.site, ref: state.ref },
    buildPageRow,
  );
  syncSelectionUI(root, state);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {{ visiblePages: { helixPath: string }[], statusChecking: boolean }} opts
 */
function buildPagesSelectionRow(state, { visiblePages, statusChecking }) {
  const row = el('div', 'bulk-pp-pages-selection-row');
  const selectionPill = el('span', 'bulk-pp-selection-pill', formatSelectionPillText(state));
  selectionPill.id = 'bulk-pp-selection-pill';
  row.append(selectionPill);

  const interactionsLocked = isStatusFetchBlocking(state);
  const selectAllBtn = el('button', 'bulk-pp-btn bulk-pp-btn-text', 'Select all');
  const selectNoneBtn = el('button', 'bulk-pp-btn bulk-pp-btn-text', 'Clear');
  selectAllBtn.type = 'button';
  selectNoneBtn.type = 'button';
  selectAllBtn.id = 'bulk-pp-select-all';
  selectNoneBtn.id = 'bulk-pp-select-none';
  selectAllBtn.disabled = visiblePages.length === 0 || interactionsLocked;
  selectNoneBtn.disabled = visiblePages.length === 0
    || interactionsLocked
    || getActiveSelectionCount(state) === 0;
  selectAllBtn.addEventListener('click', () => state.onSelectAll(true));
  selectNoneBtn.addEventListener('click', () => state.onSelectAll(false));
  row.append(selectAllBtn, selectNoneBtn);
  return row;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {boolean} workspaceLocked
 */
function buildPagesHeader(state, workspaceLocked) {
  const header = el('div', 'bulk-pp-pages-header');
  const topRow = el('div', 'bulk-pp-pages-header-top');
  const main = el('div', 'bulk-pp-pages-header-main');
  main.append(buildPagesSectionHead(state, workspaceLocked));

  const aside = el('div', 'bulk-pp-pages-header-aside');
  if (state.pages.length > 0) {
    aside.append(buildPagesStatusSummary(state));
  } else {
    const countEl = el('span', 'bulk-pp-section-count', '0');
    countEl.id = 'bulk-pp-page-count';
    aside.append(countEl);
  }
  topRow.append(main, aside);
  header.append(topRow);

  const breadcrumb = buildBreadcrumb(
    state.folderPath,
    (path) => state.onNavigate(path),
    workspaceLocked,
  );
  breadcrumb.classList.add('bulk-pp-pages-breadcrumb');
  header.append(breadcrumb, buildPagesScopeRow(state, workspaceLocked));

  return header;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string[]} helixPaths
 */
function removePagesFromState(state, helixPaths) {
  const remove = new Set(helixPaths);
  state.pages = state.pages.filter((p) => !remove.has(p.helixPath));
  helixPaths.forEach((path) => state.selected.delete(path));
  const nextStatus = { ...state.platformStatus };
  helixPaths.forEach((path) => {
    delete nextStatus[path];
  });
  state.platformStatus = nextStatus;
  removePathsFromStatusCache(state.org, state.site, state.ref, helixPaths);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {Function | null} daFetch
 * @param {string[]} paths
 * @param {'preview'|'live'|'unpreview'|'unpublish'|'delete'} topic
 */
async function refreshPlatformStatusAfterJob(state, daFetch, paths, topic) {
  if (!daFetch || paths.length === 0) return;
  if (topic === 'delete') {
    removePathsFromStatusCache(state.org, state.site, state.ref, paths);
    return;
  }
  try {
    const refreshed = await fetchPlatformStatusForPaths(
      daFetch,
      state.org,
      state.site,
      state.ref,
      paths,
    );
    commitPlatformStatus(state, refreshed);
  } catch (refreshErr) {
    console.warn('[bulk-pp] status refresh after job failed', refreshErr);
    const optimistic = buildOptimisticStatusPatch(topic, paths, state.platformStatus);
    if (Object.keys(optimistic).length > 0) {
      commitPlatformStatus(state, optimistic);
    }
  }
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string[]} paths
 * @param {string} [phaseLabel]
 * @param {Record<string, unknown>} job
 */
function applyJobProgress(state, paths, phaseLabel, job) {
  const progress = job.progress || job.job?.progress;
  if (progress && typeof progress === 'object') {
    const { total, processed, failed } = /** @type {{
      total?: number,
      processed?: number,
      failed?: number,
    }} */ (progress);
    const proc = Number(processed ?? 0);
    const tot = Number(total ?? paths.length);
    state.jobProgressProcessed = proc;
    state.jobProgressTotal = tot || paths.length;
    updateJobModal({
      jobStartedAt: state.jobStartedAt,
      processed: proc,
      total: tot || paths.length,
      failed: Number(failed ?? 0),
      stateLabel: String(job.state || job.job?.state || 'running'),
      phaseLabel,
    });
  }
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string[]} paths
 * @param {string} phaseLabel
 * @param {number} processed
 * @param {number} failed
 * @param {number} [total]
 */
function setSequentialProgress(state, paths, phaseLabel, processed, failed, total = paths.length) {
  state.jobProgressProcessed = processed;
  state.jobProgressTotal = total;
  updateJobModal({
    jobStartedAt: state.jobStartedAt,
    processed,
    total,
    failed,
    stateLabel: 'running',
    phaseLabel,
  });
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {Function} daFetch
 * @param {'preview'|'live'} partition
 * @param {string[]} paths
 * @param {string} phaseLabel
 */
async function runRemovePartitionJob(state, daFetch, partition, paths, phaseLabel) {
  const finalJob = await runBulkRemoveJob(
    daFetch,
    state.org,
    state.site,
    state.ref,
    partition,
    paths,
    (job) => {
      if (state.jobAbort?.signal.aborted) return;
      applyJobProgress(state, paths, phaseLabel, job);
    },
    state.jobAbort?.signal,
  );
  return resolveJobOutcome(finalJob);
}

function buildStatusLegend() {
  const legend = el('div', 'bulk-pp-status-legend');
  legend.setAttribute('aria-label', 'Deployment status key');
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

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function buildPagesStatusSummary(state) {
  if (isDeploymentStatusPending(state)) {
    return buildPagesStatusSummaryLoading();
  }
  const helixPaths = state.pages.map((p) => p.helixPath);
  const { live, previewOnly, none, total } = deploymentCountsForPaths(
    state.platformStatus,
    helixPaths,
  );
  const loading = state.statusRevalidating;
  const strip = el('div', `bulk-pp-pages-summary${loading ? ' bulk-pp-pages-summary-loading' : ''}`);
  strip.id = 'bulk-pp-pages-summary';
  strip.setAttribute('aria-label', 'Deployment summary for pages in this view');

  /** @type {[string, number, string][]} */
  const items = [
    ['live', live, 'Published'],
    ['preview', previewOnly, 'Preview only'],
    ['none', none, 'Not deployed'],
    ['total', total, 'Total in view'],
  ];
  items.forEach(([mod, value, label]) => {
    const item = el('div', `bulk-pp-pages-summary-item bulk-pp-pages-summary-${mod}`);
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
  const filterField = el('div', 'bulk-pp-pages-filter-field bulk-pp-field-filter');
  const filterSelect = document.createElement('select');
  filterSelect.id = 'bulk-pp-page-filter';
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
function shouldShowStatusProgressBar(state) {
  return state.hasCompletedInitialStatusFetch && isStatusFetchLockingUi(state);
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
  const locked = isFirstSessionStatusPending(state) && !state.contentLoading;
  root.classList.toggle('bulk-pp-first-session-loading', locked);
  let overlay = root.querySelector('#bulk-pp-first-session-overlay');
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
  head.append(el('span', 'bulk-pp-pages-status-progress-title', 'Fetching deployment status'));
  const stopBtn = el('button', 'bulk-pp-btn bulk-pp-btn-text bulk-pp-pages-status-progress-stop', 'Stop');
  stopBtn.type = 'button';
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
    label.textContent = total > 0
      ? `${done} of ${total} pages checked (${pct}%)`
      : 'Starting…';
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
  filterSelect?.addEventListener('change', () => {
    if (!filterSelect || filterSelect.disabled) return;
    state.pageFilter = filterSelect.value;
    patchPageSearchResults(
      root,
      state,
      { org: state.org, site: state.site, ref: state.ref },
      buildPageRow,
    );
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
 * Uncheck legacy fetch flag after a status run finishes.
 * @param {ReturnType<typeof createAppState>} state
 */
function resetFetchStatusOption(state) {
  state.fetchStatus = false;
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
  const { live, preview, none } = countStatusBreakdown(statusMap, pages);
  return { live, previewOnly: preview, none, total: helixPaths.length };
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string[]} helixPaths
 * @param {Record<string, { previewedAt?: number, publishedAt?: number }>} platformStatus
 */
function finishStatusFetch(state) {
  const root = /** @type {HTMLElement | null} */ (state.root);
  if (root) render(root, state);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function finishProgressModal(state) {
  const root = /** @type {HTMLElement | null} */ (state.root);
  closeJobModal(root);
  state.jobTopic = null;
  state.jobAbort = null;
  state.jobStartedAt = null;
  if (root) render(root, state);
}

/**
 * @param {boolean} [isFirstLoad]
 */
function buildContentLoadingPanel(isFirstLoad = false) {
  const loading = el('div', 'bulk-pp-content-loading');
  const inner = el('div', 'bulk-pp-content-loading-inner');
  const spinner = el('div', 'bulk-pp-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  inner.append(
    spinner,
    el(
      'p',
      'bulk-pp-content-loading-title',
      'Fetching content…',
    ),
    el(
      'p',
      'bulk-pp-content-loading-sub',
      isFirstLoad
        ? 'Loading folders, pages, and deployment status…'
        : 'Updating folders and pages…',
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
  overlay.setAttribute('aria-label', 'Fetching content');
  const inner = el('div', 'bulk-pp-first-session-overlay-inner');
  const spinner = el('div', 'bulk-pp-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  inner.append(
    spinner,
    el('p', 'bulk-pp-content-loading-title', 'Fetching content…'),
  );
  overlay.append(inner);
  return overlay;
}

function buildPagesStatusSummaryLoading() {
  const strip = el('div', 'bulk-pp-pages-summary bulk-pp-pages-summary-pending');
  strip.id = 'bulk-pp-pages-summary';
  strip.setAttribute('aria-label', 'Deployment summary loading');
  strip.append(el('span', 'bulk-pp-pages-summary-pending-text', 'Fetching content…'));
  return strip;
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function render(root, state) {
  const listWrapBefore = document.getElementById('bulk-pp-page-list-wrap');
  const savedListScroll = listWrapBefore ? listWrapBefore.scrollTop : null;

  const {
    org, site, ref, folderPath, loading, error, status, statusType, jobDetail,
    pageFilter, pageScope, statusCheckFailed, statusError,
    statusChecking, pageSearch, folderSearch, contentLoading,
    statusFetched,
  } = state;

  const { visible: visiblePages, statusMap, browseFolder } = getVisiblePages(state);
  const visibleFolders = getVisibleFolders(state);
  const workspaceLocked = isStatusFetchBlocking(state);
  const safeFolder = resolveContentFolderPath(folderPath);
  const searchDraft = String(pageSearch || '').trim();
  const searchTooShort = searchDraft.length > 0 && searchDraft.length < SEARCH_MIN_LEN;
  const folderSearchDraft = String(folderSearch || '').trim();
  const folderSearchTooShort = folderSearchDraft.length > 0
    && folderSearchDraft.length < SEARCH_MIN_LEN;

  root.replaceChildren();
  root.classList.add('bulk-pp-shell');
  root.classList.toggle('bulk-pp-modal-open', isProgressModalOpen());
  syncStatusFetchLockUi(root, state);
  syncFirstSessionLockUi(root, state);
  const hasWorkspace = !contentLoading && !error
    && (state.pages.length > 0 || state.folders.length > 0 || statusChecking);
  const header = el('header', 'bulk-pp-header');
  const headerInner = el('div', 'bulk-pp-header-inner');
  const headerBrand = el('div', 'bulk-pp-header-brand');
  headerBrand.append(
    el('span', 'bulk-pp-header-eyebrow', 'Adobe Experience Manager · Edge Delivery'),
    el('h1', null, APP_TITLE),
    el('p', 'bulk-pp-header-desc', APP_DESCRIPTION),
  );
  const headerMeta = el('div', 'bulk-pp-header-meta');
  const branchBadge = el('span', 'bulk-pp-badge bulk-pp-badge-muted', ref);
  branchBadge.title = 'Branch';
  const repoBadge = el('span', 'bulk-pp-badge bulk-pp-badge-muted', site);
  repoBadge.title = 'Repository';
  const orgBadge = el('span', 'bulk-pp-badge', org);
  orgBadge.title = 'Organization';
  headerMeta.append(branchBadge, repoBadge, orgBadge);
  headerInner.append(headerBrand, headerMeta);
  header.append(headerInner);
  root.append(header);

  const contentPanel = el('section', 'bulk-pp-panel bulk-pp-panel-content bulk-pp-panel-fill');
  const contentHead = el('div', 'bulk-pp-panel-head');
  const contentHeadMain = el('div', 'bulk-pp-panel-head-main');
  contentHeadMain.append(el('h2', null, 'Site content'));
  contentHead.append(contentHeadMain);
  contentPanel.append(contentHead);
  const contentBody = el('div', 'bulk-pp-panel-body bulk-pp-content-body');

  if (contentLoading) {
    contentBody.append(buildContentLoadingPanel(state.firstSessionLoad));
  } else if (error) {
    if (isDaAccessError(error)) {
      contentBody.append(buildDaAccessErrorPanel(error));
    } else {
      contentBody.append(el('p', 'bulk-pp-list-empty bulk-pp-list-empty-error', error));
    }
  } else if (state.pages.length === 0 && state.folders.length === 0 && !statusChecking) {
    contentBody.append(el(
      'p',
      'bulk-pp-list-empty',
      'No folders or pages in this location.',
    ));
  } else {
    const workspace = el('div', 'bulk-pp-workspace');
    const contentGrid = el('div', 'bulk-pp-content-grid');

    const folderSection = el('section', 'bulk-pp-content-section bulk-pp-content-section-folders');
    const folderCountLabel = folderSearchDraft && !folderSearchTooShort
      ? `${visibleFolders.length} of ${state.folders.length}`
      : String(state.folders.length);
    folderSection.append(buildSectionHead('Directories', folderCountLabel, 'bulk-pp-folder-count', 'folders'));
    folderSection.append(buildBreadcrumb(
      safeFolder,
      (path) => state.onNavigate(path),
      workspaceLocked,
    ));

    const folderSearchDisabled = workspaceLocked || state.folders.length === 0;
    const { wrap: folderSearchField, input: folderSearchInput } = buildSearchField(
      'bulk-pp-folder-search',
      'Search folder',
      String(folderSearch || ''),
      folderSearchDisabled,
      searchHintText(folderSearch),
    );
    const folderSearchRow = el('div', 'bulk-pp-search-row');
    folderSearchRow.append(folderSearchField);
    folderSection.append(folderSearchRow);

    const folderWrap = el('div', 'bulk-pp-list-wrap bulk-pp-list-wrap-folders');
    const folderList = el('ul', 'bulk-pp-list');
    folderList.id = 'bulk-pp-folder-list';
    if (visibleFolders.length === 0) {
      const folderEmptyMsg = folderSearchDraft
        ? 'No folders match this search.'
        : 'No subfolders here — pages in this folder are listed on the right.';
      folderList.append(el('li', 'bulk-pp-list-empty', folderEmptyMsg));
    } else {
      visibleFolders.forEach((folder) => {
        folderList.append(buildFolderRow(
          folder,
          (path) => state.onNavigate(path),
          workspaceLocked,
        ));
      });
    }
    folderWrap.append(folderList);
    folderSection.append(folderWrap);
    contentGrid.append(folderSection);

    bindSearchInput(folderSearchInput, state, 'folder', () => {
      patchFolderSearchResults(root, state, buildFolderRow);
    });

    const pagesSection = el('section', 'bulk-pp-content-section bulk-pp-content-section-pages');
    if (shouldShowStatusProgressBar(state)) {
      pagesSection.append(buildPagesStatusProgressBar(state));
    }
    pagesSection.append(buildPagesHeader(state, workspaceLocked));

    const controls = el('div', 'bulk-pp-pages-controls');

    const toolbarRow = el('div', 'bulk-pp-pages-toolbar-row');
    const pageSearchDisabled = workspaceLocked || state.pages.length === 0;
    const { wrap: searchField, input: searchInput } = buildSearchField(
      'bulk-pp-page-search',
      'Search page',
      String(pageSearch || ''),
      pageSearchDisabled,
      searchHintText(pageSearch),
    );
    searchField.classList.add('bulk-pp-pages-search-field');
    toolbarRow.append(searchField);

    const { filterField, filterSelect } = buildPagesFilterField(
      state,
      String(pageFilter || 'all'),
      state.contentLoading || workspaceLocked || isDeploymentStatusPending(state),
    );
    toolbarRow.append(filterField);
    controls.append(toolbarRow);

    if (state.pages.length > 0 && !isFirstSessionStatusPending(state)) {
      const legendRow = el('div', 'bulk-pp-pages-legend-row');
      legendRow.id = 'bulk-pp-pages-legend-row';
      legendRow.append(buildStatusLegend());
      if ((statusChecking || state.statusRevalidating) && !isDeploymentStatusPending(state)) {
        const hintText = state.statusRevalidating && !statusChecking
          ? 'Refreshing status…'
          : 'Updating status…';
        legendRow.append(el('span', 'bulk-pp-pages-status-hint', hintText));
      }
      controls.append(legendRow);
    }

    if (!isFirstSessionStatusPending(state)) {
      controls.append(buildPagesSelectionRow(state, { visiblePages, statusChecking }));
    }
    pagesSection.append(controls);

    const pageWrap = el('div', 'bulk-pp-list-wrap bulk-pp-list-wrap-pages bulk-pp-list-wrap-fill');
    pageWrap.id = 'bulk-pp-page-list-wrap';
    if (!isFirstSessionStatusPending(state)) {
      if (state.pages.length > 0) {
        pageWrap.append(buildPageListColumnHeader());
      }
      const pageList = el('ul', 'bulk-pp-list');
      pageList.id = 'bulk-pp-page-list';
      if (state.pages.length === 0) {
        pageList.append(el('li', 'bulk-pp-list-empty', 'No pages in this scope.'));
      } else if (visiblePages.length === 0) {
        const emptyMsg = searchDraft
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
            shouldShowPageStatus(state),
            { org, site, ref },
            workspaceLocked,
          ));
        });
      }
      pageWrap.append(pageList);
    }
    pagesSection.append(pageWrap);
    contentGrid.append(pagesSection);
    workspace.append(contentGrid);
    contentBody.append(workspace);

    bindDeploymentFilterSelect(filterSelect, root, state);
    bindSearchInput(searchInput, state, 'page', () => {
      patchPageSearchResults(root, state, { org, site, ref }, buildPageRow);
    });
    syncSelectionUI(root, state);
  }
  contentPanel.append(contentBody);
  root.append(contentPanel);

  if (!isFirstSessionStatusPending(state)) {
    root.append(buildSelectionActionBar(state));
  }

  if (status && !statusChecking && statusType === 'error' && !isDaAccessError(status)) {
    const statusEl = el('div', `bulk-pp-status bulk-pp-status-${statusType}`);
    statusEl.setAttribute('role', 'alert');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.append(el('strong', null, status));
    if (jobDetail) statusEl.append(el('pre', 'bulk-pp-error-detail', jobDetail));
    root.append(statusEl);
  } else if (jobDetail && new URLSearchParams(window.location.search).has('debug')) {
    const statusEl = el('div', 'bulk-pp-status bulk-pp-status-info');
    statusEl.append(el('pre', 'bulk-pp-error-detail', jobDetail));
    root.append(statusEl);
  }

  requestAnimationFrame(() => {
    if (savedListScroll != null) {
      const listWrap = document.getElementById('bulk-pp-page-list-wrap');
      if (listWrap) listWrap.scrollTop = savedListScroll;
    }
  });
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string[]} pathsToCheck
 */
function pathsMatchCurrentPages(state, pathsToCheck) {
  if (state.pages.length !== pathsToCheck.length) return false;
  const current = new Set(state.pages.map((p) => p.helixPath));
  return pathsToCheck.every((path) => current.has(path));
}

/**
 * Show cached status immediately, then refresh from the API without blocking the UI.
 * Picks up preview/publish changes made directly in DA.
 * @param {ReturnType<typeof createAppState>} state
 * @param {Function | null} daFetch
 * @param {string[]} pathsToCheck
 */
async function revalidateCachedStatusInBackground(state, daFetch, pathsToCheck) {
  if (!daFetch || pathsToCheck.length === 0) return;

  cancelStatusRevalidate(state);
  const controller = new AbortController();
  state.statusRevalidateAbort = controller;
  state.statusRevalidating = true;
  refreshDeploymentUi(state);

  try {
    const fresh = await fetchPlatformStatusForPaths(
      daFetch,
      state.org,
      state.site,
      state.ref,
      pathsToCheck,
      (partial) => {
        if (!pathsMatchCurrentPages(state, pathsToCheck)) return;
        state.platformStatus = { ...state.platformStatus, ...partial };
        refreshDeploymentUi(state);
      },
      { signal: controller.signal },
    );
    if (controller.signal.aborted || !pathsMatchCurrentPages(state, pathsToCheck)) return;
    commitPlatformStatus(state, { ...state.platformStatus, ...fresh });
    state.statusCheckFailed = false;
    state.statusError = null;
    const root = /** @type {HTMLElement | null} */ (state.root);
    refreshDeploymentUi(state);
    if (root) render(root, state);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    console.warn('[bulk-pp] background status revalidate failed', err);
  } finally {
    if (state.statusRevalidateAbort === controller) {
      state.statusRevalidateAbort = null;
    }
    state.statusRevalidating = false;
    refreshDeploymentUi(state);
  }
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {Function | null} daFetch
 * @param {string[]} pathsToCheck
 * @param {string} location
 * @param {number} docCount
 * @param {number} folderCount
 * @param {{ background?: boolean }} [options]
 */
function startStatusCheck(state, daFetch, pathsToCheck, location, docCount, folderCount, options = {}) {
  const background = Boolean(options.background);
  cancelStatusCheck(state, false);
  state.statusCancelled = false;
  state.statusCheckFailed = false;
  state.statusError = null;
  state.statusPanelNote = null;
  state.statusFetchBackground = background && pathsToCheck.length > 0;
  state.statusChecking = pathsToCheck.length > 0;
  state.statusProgressDone = 0;
  state.statusProgressTotal = pathsToCheck.length;
  state.statusFetchStartedAt = pathsToCheck.length > 0 ? Date.now() : null;
  state.statusAbort = new AbortController();

  if (pathsToCheck.length === 0) {
    state.statusChecking = false;
    state.statusFetchBackground = false;
    state.statusFetched = false;
    markInitialStatusFetchComplete(state);
    resetFetchStatusOption(state);
    state.status = folderCount === 0 && docCount === 0
      ? `No folders or pages in ${location}.`
      : `Loaded ${docCount} page(s) in ${location}.`;
    state.statusType = 'info';
    render(/** @type {HTMLElement} */ (state.root), state);
    return;
  }

  const root = /** @type {HTMLElement | null} */ (state.root);
  hydratePlatformStatusFromCache(state, pathsToCheck);

  if (hasCompleteCachedStatus(state.org, state.site, state.ref, pathsToCheck)) {
    state.statusChecking = false;
    state.statusFetchBackground = false;
    state.statusFetched = true;
    markInitialStatusFetchComplete(state);
    state.statusProgressDone = pathsToCheck.length;
    state.statusProgressTotal = pathsToCheck.length;
    state.statusAbort = null;
    state.statusFetchStartedAt = null;
    resetFetchStatusOption(state);
    state.status = null;
    state.statusType = 'info';
    refreshDeploymentUi(state);
    if (root) render(root, state);
    void revalidateCachedStatusInBackground(state, daFetch, pathsToCheck);
    return;
  }

  const pathsToFetch = getUncachedHelixPaths(
    state.org,
    state.site,
    state.ref,
    pathsToCheck,
  );
  const cachedCount = pathsToCheck.length - pathsToFetch.length;
  state.statusProgressDone = cachedCount;
  state.statusProgressTotal = pathsToCheck.length;

  refreshDeploymentUi(state);

  fetchPlatformStatusForPaths(
    daFetch,
    state.org,
    state.site,
    state.ref,
    pathsToFetch,
    (partial, done) => {
      state.platformStatus = { ...state.platformStatus, ...partial };
      state.statusProgressDone = cachedCount + done;
      state.statusProgressTotal = pathsToCheck.length;
      refreshDeploymentUi(state);
    },
    { signal: state.statusAbort.signal },
  ).then((platformStatus) => {
    if (state.statusAbort?.signal.aborted) return;
    commitPlatformStatus(state, { ...state.platformStatus, ...platformStatus });
    state.statusChecking = false;
    state.statusFetchBackground = false;
    state.statusFetched = true;
    markInitialStatusFetchComplete(state);
    state.statusAbort = null;
    state.statusFetchStartedAt = null;
    state.statusProgressDone = pathsToCheck.length;
    state.statusProgressTotal = pathsToCheck.length;
    resetFetchStatusOption(state);
    state.status = null;
    state.statusType = 'info';
    refreshDeploymentUi(state);
    finishStatusFetch(state);
  }).catch((statusErr) => {
    if (statusErr instanceof DOMException && statusErr.name === 'AbortError') {
      state.statusChecking = false;
      state.statusFetchBackground = false;
      state.statusAbort = null;
      state.statusFetchStartedAt = null;
      resetFetchStatusOption(state);
      const root = /** @type {HTMLElement | null} */ (state.root);
      const checked = state.statusProgressDone;
      const total = state.statusProgressTotal;
      if (checked > 0) {
        persistCurrentPlatformStatus(state);
        state.statusFetched = true;
        markInitialStatusFetchComplete(state);
        refreshDeploymentUi(state);
      } else {
        markInitialStatusFetchComplete(state);
      }
      state.statusPanelNote = checked > 0
        ? `Stopped after ${checked} of ${total} pages. Partial results are shown.`
        : 'Status check cancelled.';
      if (root) render(root, state);
      return;
    }
    state.statusChecking = false;
    state.statusFetchBackground = false;
    state.statusAbort = null;
    state.statusFetchStartedAt = null;
    resetFetchStatusOption(state);

    const hadProgress = state.statusProgressDone > 0;
    const root = /** @type {HTMLElement | null} */ (state.root);
    if (hadProgress) {
      persistCurrentPlatformStatus(state);
      state.statusFetched = true;
      markInitialStatusFetchComplete(state);
      state.statusCheckFailed = true;
      state.statusError = messageFromApiError(statusErr, 'Status check failed.', 'status');
      state.status = `${state.statusError} Partial results were saved.`;
      state.statusType = 'error';
    } else if (hasCompleteCachedStatus(state.org, state.site, state.ref, pathsToCheck)) {
      hydratePlatformStatusFromCache(state, pathsToCheck);
      state.statusFetched = true;
      markInitialStatusFetchComplete(state);
      state.statusCheckFailed = false;
      state.statusError = null;
      state.status = 'Could not refresh deployment status. Showing last saved results.';
      state.statusType = 'info';
    } else {
      state.statusFetched = false;
      markInitialStatusFetchComplete(state);
      state.statusCheckFailed = true;
      state.statusError = messageFromApiError(statusErr, 'Status check failed.', 'status');
      state.status = state.statusError;
      state.statusType = 'error';
    }
    console.warn('[bulk-pp] platform status failed', statusErr);
    if (root) render(root, state);
  });
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string} location
 * @param {number} docCount
 * @param {number} folderCount
 */
function finishContentLoadWithoutStatus(state, location, docCount, folderCount) {
  state.firstSessionLoad = false;
  state.statusFetchBackground = false;
  state.statusChecking = false;
  state.statusFetched = false;
  markInitialStatusFetchComplete(state);
  state.statusCheckFailed = false;
  state.statusError = null;
  state.platformStatus = {};
  if (folderCount === 0 && docCount === 0) {
    state.status = `No folders or pages in ${location}.`;
  } else if (state.pageScope === 'tree') {
    state.status = `Loaded ${docCount} page(s) under ${location} (all subdirectories).`;
  } else {
    state.status = `Loaded ${docCount} page(s) and ${folderCount} folder(s) in ${location}.`;
  }
  state.statusType = 'info';
  render(/** @type {HTMLElement} */ (state.root), state);
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
  const urlParams = new URLSearchParams(window.location.search);
  const urlRef = urlParams.get('ref');
  if (urlRef) state.ref = urlRef;
  const urlPath = urlParams.get('path');
  if (urlPath) state.folderPath = resolveContentFolderPath(normalizeFolderPath(urlPath));
  syncUrlPath(state.ref, state.folderPath);

  state.onCancelStatus = () => {
    const checked = state.statusProgressDone;
    const total = state.statusProgressTotal;
    cancelStatusCheck(state, false);
    resetFetchStatusOption(state);
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
    if (root) render(root, state);
  };

  state.onCancelJob = () => {
    cancelBulkJob(state, false);
    if (app) syncSelectionUI(app, state);
    const topic = /** @type {JobTopic} */ (state.jobTopic || 'preview');
    const actionLabel = jobActionLabel(topic);
    showJobCancelledModal({
      message: `You stopped tracking this bulk ${actionLabel} operation. If it already started on the server, work may still be in progress. Check the Pages panel or run Fetch Deployment status again.`,
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
    state.pageSearch = '';
    state.folderSearch = '';
    state.pageFilter = 'all';
    syncUrlPath(state.ref, state.folderPath);
    await state.onFetch(true);
  };

  state.onToggleIncludeSubdirectories = async (enabled) => {
    if (isStatusFetchBlocking(state) || state.contentLoading) return;
    const next = enabled ? 'tree' : 'folder';
    if (state.pageScope === next) return;
    closeProgressModal(/** @type {HTMLElement} */ (app));
    state.pageScope = next;
    clearPagesStatusDisplay(state);
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

    syncUrlPath(state.ref, state.folderPath);
    cancelStatusCheck(state, false);
    state.contentLoading = true;
    state.error = null;
    state.statusCancelled = false;
    state.statusFetched = false;
    state.platformStatus = {};
    state.statusCheckFailed = false;
    state.statusError = null;
    state.statusPanelNote = null;
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
      const docCount = state.pages.length;
      const location = displayFolderPath(state.folderPath) || 'site root';
      state.initialContentLoaded = true;
      const backgroundStatus = state.firstSessionLoad;
      if (backgroundStatus) {
        state.firstSessionLoad = false;
      }
      if (!backgroundStatus || docCount === 0) {
        state.contentLoading = false;
      }

      if (docCount > 0) {
        const helixPaths = state.pages.map((p) => p.helixPath);
        hydratePlatformStatusFromCache(state, helixPaths);
        startStatusCheck(
          state,
          daFetch,
          helixPaths,
          location,
          docCount,
          state.folders.length,
          { background: backgroundStatus },
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
    const root = state.root;
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
    const root = state.root;
    if (!root) return;
    syncSelectionUI(root, state);
  };

  state.onRun = async (topic) => {
    const pagePaths = new Set(state.pages.map((p) => p.helixPath));
    const paths = [...state.selected].filter((path) => pagePaths.has(path));
    if (paths.length === 0) return;

    const confirmed = await confirmBulkRun(topic, paths.length);
    if (!confirmed) return;

    applyOperationWorkspaceReset(state);

    const appRoot = /** @type {HTMLElement} */ (app);
    state.loading = true;
    state.jobTopic = topic;
    state.jobDetail = null;
    state.jobAbort = new AbortController();
    state.jobStartedAt = Date.now();
    state.jobProgressProcessed = 0;
    state.jobProgressTotal = paths.length;
    state.status = topic === 'live'
      ? `Starting bulk publish for ${paths.length} page(s)…`
      : `Starting bulk preview for ${paths.length} page(s)…`;
    state.statusType = 'info';
    openJobModal(appRoot, topic, paths.length, () => state.onCancelJob());

    const host = buildSiteHost(state.org, state.site, state.ref);
    const env = topic === 'live' ? 'live' : 'preview';
    const action = topic === 'live' ? 'Bulk publish' : 'Bulk preview';

    try {
      const bulkResp = await startBulkJob(
        daFetch,
        state.org,
        state.site,
        state.ref,
        topic,
        paths,
      );
      if (state.jobAbort?.signal.aborted) return;

      const jobUrl = getJobPollUrl(bulkResp, state.org, state.site, state.ref, topic);
      if (!jobUrl) {
        const urls = buildUrlsForPaths(paths, state.org, state.site, state.ref, env);
        state.status = topic === 'live'
          ? `Bulk publish scheduled (${paths.length} paths).`
          : `Bulk preview scheduled (${paths.length} paths).`;
        state.statusType = 'success';
        updateJobModal({
          jobStartedAt: state.jobStartedAt,
          processed: paths.length,
          total: paths.length,
          failed: 0,
          stateLabel: 'complete',
        });
        await refreshPlatformStatusAfterJob(state, daFetch, paths, topic);
        showJobCompleteModal({
          summary: state.status,
          topic,
          urls,
          host,
          onClose: () => finishProgressModal(state),
        });
        return;
      }

      const finalJob = await pollJob(daFetch, jobUrl, (job) => {
        if (state.jobAbort?.signal.aborted) return;
        const progress = job.progress || job.job?.progress;
        if (progress && typeof progress === 'object') {
          const { total, processed, failed } = /** @type {{ total?: number, processed?: number, failed?: number }} */ (progress);
          const proc = Number(processed ?? 0);
          const tot = Number(total ?? paths.length);
          state.jobProgressProcessed = proc;
          state.jobProgressTotal = tot || paths.length;
          updateJobModal({
            jobStartedAt: state.jobStartedAt,
            processed: proc,
            total: tot || paths.length,
            failed: Number(failed ?? 0),
            stateLabel: String(job.state || job.job?.state || 'running'),
          });
        }
      }, state.jobAbort?.signal);

      if (state.jobAbort?.signal.aborted) return;

      const outcome = resolveJobOutcome(finalJob);
      state.status = `${action} ${outcome.message}`;
      state.statusType = outcome.statusType;

      let urls = [];
      if (outcome.statusType === 'success') {
        urls = buildUrlsForPaths(paths, state.org, state.site, state.ref, env);
        await refreshPlatformStatusAfterJob(state, daFetch, paths, topic);
      }

      state.jobDetail = outcome.statusType === 'error'
        || new URLSearchParams(window.location.search).has('debug')
        ? JSON.stringify(finalJob, null, 2)
        : null;

      if (outcome.statusType === 'error') {
        showJobErrorModal({
          message: state.status,
          topic,
          hint: permissionErrorHint(0, state.status),
          onClose: () => finishProgressModal(state),
        });
      } else {
        showJobCompleteModal({
          summary: state.status,
          topic,
          urls,
          host,
          onClose: () => finishProgressModal(state),
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      presentJobError(state, topic, err, topic);
    } finally {
      state.loading = false;
      state.jobAbort = null;
      state.jobStartedAt = null;
    }
  };

  state.onRunDestructive = async (action) => {
    const pageByPath = new Map(state.pages.map((p) => [p.helixPath, p]));
    const paths = getSelectedHelixPaths(state);
    if (paths.length === 0) return;

    const ok = await confirmDestructiveAction(action, paths.length);
    if (!ok) return;

    applyOperationWorkspaceReset(state);

    const appRoot = /** @type {HTMLElement} */ (app);
    const topic = /** @type {'unpreview'|'unpublish'|'delete'} */ (action);
    state.loading = true;
    state.jobTopic = topic;
    state.jobDetail = null;
    state.jobAbort = new AbortController();
    state.jobStartedAt = Date.now();
    state.jobProgressProcessed = 0;
    state.jobProgressTotal = paths.length;
    state.statusType = 'info';
    state.status = destructiveStartMessage(action, paths.length);
    openJobModal(appRoot, topic, paths.length, () => state.onCancelJob());

    /** @type {string[]} */
    const notes = [];
    let statusType = 'success';

    try {
      if (action === 'unpreview' || action === 'delete') {
        try {
          const outcome = await runRemovePartitionJob(
            state,
            daFetch,
            'preview',
            paths,
            action === 'delete' ? 'Step 1 of 3 · Unpreview' : 'Unpreview',
          );
          notes.push(`Preview removal ${outcome.message}`);
          if (outcome.statusType === 'error') statusType = 'error';
          else if (outcome.statusType === 'info' && statusType === 'success') statusType = 'info';
        } catch (phaseErr) {
          if (phaseErr instanceof DOMException && phaseErr.name === 'AbortError') return;
          notes.push(`Preview removal failed: ${messageFromApiError(phaseErr, 'Preview removal failed.', 'unpreview')}`);
          statusType = 'error';
          console.warn('[bulk-pp] unpreview phase failed', phaseErr);
        }
      }

      if (state.jobAbort?.signal.aborted) return;

      if (action === 'unpublish' || action === 'delete') {
        try {
          const outcome = await runRemovePartitionJob(
            state,
            daFetch,
            'live',
            paths,
            action === 'delete' ? 'Step 2 of 3 · Unpublish' : 'Unpublish',
          );
          notes.push(`Unpublish ${outcome.message}`);
          if (outcome.statusType === 'error') statusType = 'error';
          else if (outcome.statusType === 'info' && statusType === 'success') statusType = 'info';
        } catch (phaseErr) {
          if (phaseErr instanceof DOMException && phaseErr.name === 'AbortError') return;
          notes.push(`Unpublish failed: ${messageFromApiError(phaseErr, 'Unpublish failed.', 'unpublish')}`);
          statusType = 'error';
          console.warn('[bulk-pp] unpublish phase failed', phaseErr);
        }
      }

      if (state.jobAbort?.signal.aborted) return;

      if (action === 'delete') {
        const pages = paths
          .map((path) => pageByPath.get(path))
          .filter(Boolean);
        const daResult = await deleteDaDocumentsSequential(
          daFetch,
          state.org,
          state.site,
          pages,
          ({ processed, total, failed }) => {
            if (state.jobAbort?.signal.aborted) return;
            setSequentialProgress(state, paths, 'Step 3 of 3 · Delete from DA', processed, failed, total);
          },
          state.jobAbort?.signal,
        );

        if (daResult.deleted.length > 0) {
          removePagesFromState(state, daResult.deleted);
          notes.push(`Deleted ${daResult.deleted.length} document${daResult.deleted.length === 1 ? '' : 's'} from DA`);
        }
        if (daResult.failed > 0) {
          statusType = daResult.deleted.length > 0 ? 'info' : 'error';
          const sample = daResult.errors.slice(0, 3).map((e) => `${e.helixPath}: ${e.message}`).join('; ');
          notes.push(`${daResult.failed} delete${daResult.failed === 1 ? '' : 's'} failed${sample ? ` (${sample})` : ''}`);
        }
      }

      if (state.jobAbort?.signal.aborted) return;

      if (statusType !== 'error') {
        await refreshPlatformStatusAfterJob(state, daFetch, paths, action);
      }

      const summary = notes.filter(Boolean).join('. ') || 'Operation finished.';
      state.status = summary;
      state.statusType = statusType;

      updateJobModal({
        jobStartedAt: state.jobStartedAt,
        processed: paths.length,
        total: paths.length,
        failed: 0,
        stateLabel: 'complete',
      });

      if (statusType === 'error') {
        showJobErrorModal({
          message: summary,
          topic,
          hint: permissionErrorHint(0, summary),
          onClose: () => finishProgressModal(state),
        });
      } else {
        showJobCompleteModal({
          summary,
          topic,
          onClose: () => finishProgressModal(state),
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      presentJobError(state, topic, err, action);
    } finally {
      state.loading = false;
      state.jobAbort = null;
      state.jobStartedAt = null;
    }
  };

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
  state.status = 'Fetching content…';
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
    el('p', 'bulk-pp-boot-error-hint', 'Hard refresh (Cmd+Shift+R). If this persists, check the browser console for the failing module.'),
  );
  app.append(panel);
}

main().catch(showBootError);
