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
} from './lib/api.js';
import {
  displayFolderPath,
  formatPageListLabel,
  normalizeFolderPath,
  resolveContentFolderPath,
} from './lib/paths.js';
import {
  buildDaEditUrl,
  buildSiteHost,
  buildUrlsForPaths,
} from './lib/urls.js';
import {
  countStatusBreakdown,
  formatStatusDate,
  getPageStatus,
  PAGE_FILTERS,
  statusLabel,
} from './lib/page-history.js';
import {
  confirmBulkRun,
  confirmCheckDeploymentStatus,
  confirmDestructiveAction,
  confirmOpenUrlsInNewTabs,
} from './lib/modal.js';
import {
  openUrlsInNewTabsQuiet,
  shouldWarnPopupBlock,
} from './lib/ui-utils.js';
import {
  closeJobModal,
  isJobModalOpen,
  isProgressModalOpen,
  openJobModal,
  showJobCancelledModal,
  showJobCompleteModal,
  showJobErrorModal,
  updateJobModal,
} from './lib/progress-modal.js';
import { formatStatusFetchEta } from './lib/status-estimate.js';
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
  clearPageWorkspaceAfterOperation,
  createAppState,
  formatSelectionPillText,
  getActiveSelectionCount,
  getSelectedHelixPaths,
  getVisiblePages,
  getVisibleFolders,
  isStatusLoaded,
  resetWorkspace,
  SEARCH_MIN_LEN,
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

const APP_TITLE = 'Content Deployment Hub';
const APP_DESCRIPTION = 'Browse folders, select pages, and run bulk preview, publish, or removal at the current directory level.';
const WORKFLOW_STEPS = [
  { n: 1, label: 'Open a folder', detail: 'Browse the tree — pages in that folder load automatically' },
  { n: 2, label: 'Check status', detail: 'Optional: preview & live deployment state' },
  { n: 3, label: 'Select pages', detail: 'Check pages you want to act on' },
  { n: 4, label: 'Run operation', detail: 'Use the action bar on selected pages' },
];

/** @typedef {import('./lib/state.js').PageOperationId} PageOperationId */

/** @type {{ id: PageOperationId, label: string }[]} */
const SELECTION_STRIP_OPS = [
  { id: 'preview', label: 'Preview' },
  { id: 'live', label: 'Publish' },
];

/** @type {{ id: PageOperationId, label: string }[]} */
const MORE_SELECTION_OPS = [
  { id: 'unpreview', label: 'Remove preview' },
  { id: 'unpublish', label: 'Remove from live' },
  { id: 'delete', label: 'Delete from DA' },
  { id: 'open-da', label: 'Open in Document Authoring' },
  { id: 'open-preview', label: 'Open preview site' },
  { id: 'open-live', label: 'Open live site' },
];

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
 * @returns {number}
 */
function getWorkflowStep(state) {
  if (getActiveSelectionCount(state) > 0) return 4;
  if (state.pages.length > 0 && state.statusFetched) return 3;
  if (state.pages.length > 0) return 2;
  return 1;
}

/**
 * @param {number} activeStep
 */
function buildWorkflowStrip(activeStep) {
  const strip = el('nav', 'bulk-pp-workflow');
  strip.setAttribute('aria-label', 'How to use this tool');
  WORKFLOW_STEPS.forEach((step) => {
    const item = el('div', 'bulk-pp-workflow-step');
    if (step.n < activeStep) item.classList.add('bulk-pp-workflow-step-done');
    if (step.n === activeStep) item.classList.add('bulk-pp-workflow-step-current');
    const copy = el('div', 'bulk-pp-workflow-copy');
    copy.append(
      el('span', 'bulk-pp-workflow-label', step.label),
      el('span', 'bulk-pp-workflow-detail', step.detail),
    );
    item.append(
      el('span', 'bulk-pp-workflow-num', String(step.n)),
      copy,
    );
    strip.append(item);
  });
  return strip;
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

/**
 * @param {Record<string, { previewedAt?: number, publishedAt?: number }>} platformStatus
 * @param {{ helixPath: string }[]} pages
 */
function buildDeploymentStatsBar(platformStatus, pages) {
  const map = /** @type {Record<string, { previewedAt?: number, publishedAt?: number }>} */ ({});
  pages.forEach((p) => {
    map[p.helixPath] = platformStatus[p.helixPath] || {};
  });
  const { live, preview, none } = countStatusBreakdown(map, pages);
  const bar = el('div', 'bulk-pp-deployment-stats');
  bar.id = 'bulk-pp-deployment-stats';
  bar.setAttribute('aria-label', 'Deployment summary');
  [
    ['live', 'Published', live, 'bulk-pp-stat-live'],
    ['preview', 'Preview only', preview, 'bulk-pp-stat-preview'],
    ['none', 'neither previewed nor published', none, 'bulk-pp-stat-none'],
  ].forEach(([, label, value, mod]) => {
    const card = el('div', `bulk-pp-stat-card ${mod}`);
    card.append(
      el('span', 'bulk-pp-stat-value', String(value)),
      el('span', 'bulk-pp-stat-label', label),
    );
    bar.append(card);
  });
  const total = el('div', 'bulk-pp-stat-card bulk-pp-stat-total');
  total.append(
    el('span', 'bulk-pp-stat-value', String(pages.length)),
    el('span', 'bulk-pp-stat-label', 'Pages in view'),
  );
  bar.append(total);
  return bar;
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
  const multiSelected = getActiveSelectionCount(state) > 1;
  const daDisabled = interactionsLocked || multiSelected;
  const daLink = document.createElement('a');
  daLink.className = 'bulk-pp-btn bulk-pp-btn-open-da';
  daLink.dataset.href = daUrl;
  if (daDisabled) {
    daLink.classList.add('bulk-pp-btn-open-da-disabled');
    daLink.setAttribute('aria-disabled', 'true');
    daLink.title = multiSelected
      ? 'Use More → Open in Document Authoring when multiple pages are selected'
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
  li.append(cb, icon, labelWrap, rowActions);
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
    || state.statusChecking
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
    || state.statusChecking
    || isJobModalOpen();
}

/**
 * @param {HTMLButtonElement} btn
 * @param {ReturnType<typeof createAppState>} state
 * @param {PageOperationId} operationId
 */
function bindSelectionOpButton(btn, state, operationId) {
  btn.type = 'button';
  btn.dataset.operation = operationId;
  btn.classList.add('bulk-pp-selection-strip-btn');
  if (operationId === 'delete') btn.classList.add('bulk-pp-selection-strip-btn-danger');
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
  const clearBtn = el('button', 'bulk-pp-selection-clear', '×');
  clearBtn.type = 'button';
  clearBtn.id = 'bulk-pp-selection-clear';
  clearBtn.setAttribute('aria-label', 'Clear selection');
  clearBtn.title = 'Clear selection';
  clearBtn.disabled = blocked;
  clearBtn.addEventListener('click', () => state.onSelectAll(false));

  const countEl = el('span', 'bulk-pp-selection-count', '');
  countEl.id = 'bulk-pp-selection-count';
  countEl.textContent = formatSelectionBarText(count);
  left.append(clearBtn, countEl);

  const actions = el('div', 'bulk-pp-selection-strip-actions');
  SELECTION_STRIP_OPS.forEach(({ id, label }) => {
    const btn = el('button', null, label);
    bindSelectionOpButton(btn, state, id);
    btn.disabled = blocked;
    actions.append(btn);
  });

  const moreWrap = el('div', 'bulk-pp-selection-more-wrap');
  const moreBtn = el('button', 'bulk-pp-selection-strip-btn bulk-pp-selection-more-trigger', 'More');
  moreBtn.type = 'button';
  moreBtn.id = 'bulk-pp-selection-more';
  moreBtn.setAttribute('aria-haspopup', 'true');
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.disabled = blocked;

  const menu = el('div', 'bulk-pp-selection-more-menu');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'More page operations');
  const menuPanel = el('div', 'bulk-pp-selection-more-menu-panel');
  MORE_SELECTION_OPS.forEach(({ id, label }) => {
    const item = el('button', 'bulk-pp-selection-more-item', label);
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    if (id === 'delete') item.classList.add('bulk-pp-selection-more-item-danger');
    item.disabled = blocked;
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
  actions.append(moreWrap);
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
  const root = /** @type {HTMLElement | null} */ (state.root);
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
  const filtersLocked = state.statusChecking || !state.statusFetched;
  const filterSelect = root.querySelector('#bulk-pp-page-filter');
  if (filterSelect instanceof HTMLSelectElement) {
    filterSelect.disabled = filtersLocked;
    filterSelect.querySelectorAll('option').forEach((opt) => {
      if (!(opt instanceof HTMLOptionElement)) return;
      if (opt.value === 'all') {
        opt.disabled = false;
        opt.textContent = 'All pages';
        return;
      }
      const baseLabel = PAGE_FILTERS.find(([v]) => v === opt.value)?.[1] || opt.textContent;
      opt.disabled = filtersLocked;
      opt.textContent = filtersLocked ? `${baseLabel} (requires status)` : baseLabel;
    });
  }
  const filterNote = root.querySelector('.bulk-pp-pages-filter-note');
  if (filterNote) {
    filterNote.textContent = filtersLocked
      ? 'Load deployment status to unlock filters'
      : state.pageScope === 'tree'
        ? 'Filters apply to all pages under this directory'
        : 'Filters apply to pages in this directory only';
  }
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function patchDeploymentStatusPanel(root, state) {
  const host = root.querySelector('#bulk-pp-deployment-panel-host');
  if (!host || state.pages.length === 0) return;
  host.replaceChildren(buildDeploymentStatusPanel(state));
  patchPagesFilterControls(root, state);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
function refreshDeploymentUi(state) {
  const root = /** @type {HTMLElement | null} */ (state.root);
  if (!root) return;
  patchDeploymentStatusPanel(root, state);
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
 */
function buildDeploymentStatusPanel(state) {
  const panel = el('div', 'bulk-pp-deployment-panel');
  panel.id = 'bulk-pp-deployment-panel';
  const pageCount = state.pages.length;

  if (state.statusChecking) {
    const done = state.statusProgressDone;
    const total = state.statusProgressTotal || pageCount;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const loading = el('div', 'bulk-pp-deployment-panel-loading');
    const head = el('div', 'bulk-pp-deployment-panel-head');
    head.append(
      el('span', 'bulk-pp-deployment-panel-title', 'Loading deployment status'),
      el('span', 'bulk-pp-deployment-panel-meta', `${done} of ${total} pages`),
    );
    loading.append(head);
    const track = el('div', 'bulk-pp-progress-track bulk-pp-deployment-panel-track');
    const fill = el('div', 'bulk-pp-progress-fill');
    fill.style.width = `${pct}%`;
    track.append(fill);
    loading.append(track);
    const eta = formatStatusFetchEta(total);
    loading.append(el(
      'p',
      'bulk-pp-deployment-panel-hint',
      eta ? `This usually takes ${eta}. You can keep browsing while this runs.` : 'Checking preview and publish state from AEM…',
    ));
    const cancelBtn = el('button', 'bulk-pp-btn bulk-pp-btn-text bulk-pp-deployment-panel-cancel', 'Stop');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => state.onCancelStatus());
    loading.append(cancelBtn);
    panel.append(loading);
    return panel;
  }

  if (state.statusCheckFailed) {
    const failed = el('div', 'bulk-pp-deployment-panel-failed');
    failed.append(
      el('span', 'bulk-pp-deployment-panel-title', 'Could not load deployment status'),
      el('p', 'bulk-pp-deployment-panel-error', state.statusError || 'Status check failed.'),
    );
    const retryBtn = el('button', 'bulk-pp-btn bulk-pp-btn-primary bulk-pp-btn-fetch-deployment', 'Try again');
    retryBtn.type = 'button';
    retryBtn.addEventListener('click', () => { void state.onCheckStatus(); });
    failed.append(retryBtn);
    panel.append(failed);
    return panel;
  }

  if (state.statusFetched) {
    const loaded = el('div', 'bulk-pp-deployment-panel-loaded');
    if (state.statusPanelNote) {
      loaded.append(el('p', 'bulk-pp-deployment-panel-note', state.statusPanelNote));
    }
    loaded.append(buildDeploymentStatsBar(state.platformStatus, state.pages));
    const refreshBtn = el('button', 'bulk-pp-btn bulk-pp-btn-text bulk-pp-deployment-panel-refresh', 'Refresh status');
    refreshBtn.type = 'button';
    refreshBtn.addEventListener('click', () => { void state.onCheckStatus(); });
    loaded.append(refreshBtn);
    panel.append(loaded);
    return panel;
  }

  const idle = el('div', 'bulk-pp-deployment-panel-idle');
  const copy = el('div', 'bulk-pp-deployment-panel-copy');
  copy.append(
    el('span', 'bulk-pp-deployment-panel-title', 'Deployment status'),
    el(
      'p',
      'bulk-pp-deployment-panel-lead',
      `See which of ${pageCount} page${pageCount === 1 ? '' : 's'} ${state.pageScope === 'tree' ? 'under this directory are' : 'in this directory are'} previewed or published.`,
    ),
  );
  if (state.statusPanelNote) {
    copy.append(el('p', 'bulk-pp-deployment-panel-note', state.statusPanelNote));
  }
  const loadBtn = el('button', 'bulk-pp-btn bulk-pp-btn-primary bulk-pp-btn-fetch-deployment', 'Load status');
  loadBtn.type = 'button';
  loadBtn.id = 'bulk-pp-check-status';
  loadBtn.disabled = state.contentLoading;
  loadBtn.addEventListener('click', () => { void state.onCheckStatus(); });
  idle.append(copy, loadBtn);
  panel.append(idle);
  return panel;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {boolean} contentLoading
 * @param {boolean} statusChecking
 */
function buildPageScopeRow(state, contentLoading, statusChecking) {
  const row = el('div', 'bulk-pp-scope-row');
  const field = el('div', 'bulk-pp-field bulk-pp-field-narrow bulk-pp-field-scope');
  field.append(
    el('label', null, 'Page scope'),
    el('span', 'bulk-pp-field-hint', 'This directory, or include all subdirectories'),
  );
  const select = document.createElement('select');
  select.id = 'bulk-pp-page-scope';
  select.disabled = contentLoading || statusChecking;
  [['folder', 'This directory'], ['tree', 'All subdirectories']].forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === state.pageScope) opt.selected = true;
    select.append(opt);
  });
  select.addEventListener('change', () => {
    void state.onScopeChange(select.value === 'tree' ? 'tree' : 'folder');
  });
  field.append(select);
  row.append(field);
  return row;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {{ visiblePages: { helixPath: string }[], statusChecking: boolean }} opts
 */
function buildPagesHeader(state, pageCountLabel, { visiblePages, statusChecking }) {
  const header = el('div', 'bulk-pp-pages-header');
  const left = el('div', 'bulk-pp-pages-header-left');
  left.append(buildSectionHead('Pages', pageCountLabel, 'bulk-pp-page-count', 'pages'));

  const selectionRow = el('div', 'bulk-pp-selection-row');
  selectionRow.append(
    el('span', 'bulk-pp-step-badge bulk-pp-step-badge-inline', 'Step 3'),
    el('span', 'bulk-pp-selection-pill', formatSelectionPillText(state)),
  );
  selectionRow.querySelector('.bulk-pp-selection-pill').id = 'bulk-pp-selection-pill';

  const selectAllBtn = el('button', 'bulk-pp-btn bulk-pp-btn-text', 'Select all');
  const selectNoneBtn = el('button', 'bulk-pp-btn bulk-pp-btn-text', 'Clear');
  selectAllBtn.type = 'button';
  selectNoneBtn.type = 'button';
  selectAllBtn.id = 'bulk-pp-select-all';
  selectNoneBtn.id = 'bulk-pp-select-none';
  selectAllBtn.disabled = visiblePages.length === 0 || statusChecking;
  selectNoneBtn.disabled = visiblePages.length === 0
    || statusChecking
    || getActiveSelectionCount(state) === 0;
  selectAllBtn.addEventListener('click', () => state.onSelectAll(true));
  selectNoneBtn.addEventListener('click', () => state.onSelectAll(false));
  selectionRow.append(selectAllBtn, selectNoneBtn);
  left.append(selectionRow);
  header.append(left);
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

/**
 * Uncheck "Load preview & publish status on Fetch" after a status run finishes.
 * @param {ReturnType<typeof createAppState>} state
 */
function resetFetchStatusOption(state) {
  state.fetchStatus = false;
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
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createAppState>} state
 */
function render(root, state) {
  const listWrapBefore = document.getElementById('bulk-pp-page-list-wrap');
  const savedListScroll = listWrapBefore ? listWrapBefore.scrollTop : null;
  const savedWindowY = window.scrollY;

  const {
    org, site, ref, folderPath, loading, error, status, statusType, jobDetail,
    pageFilter, pageScope, statusCheckFailed, statusError,
    statusChecking, pageSearch, folderSearch, contentLoading,
    statusFetched,
  } = state;

  const { visible: visiblePages, statusMap, browseFolder } = getVisiblePages(state);
  const visibleFolders = getVisibleFolders(state);
  const safeFolder = resolveContentFolderPath(folderPath);
  const searchDraft = String(pageSearch || '').trim();
  const searchTooShort = searchDraft.length > 0 && searchDraft.length < SEARCH_MIN_LEN;
  const folderSearchDraft = String(folderSearch || '').trim();
  const folderSearchTooShort = folderSearchDraft.length > 0
    && folderSearchDraft.length < SEARCH_MIN_LEN;

  root.replaceChildren();
  root.classList.toggle('bulk-pp-modal-open', isProgressModalOpen());
  const selectionCount = getActiveSelectionCount(state);
  const hasWorkspace = !contentLoading && !error
    && (state.pages.length > 0 || state.folders.length > 0 || statusChecking);
  root.classList.toggle('bulk-pp-reserve-action-bar', hasWorkspace);
  root.classList.toggle('bulk-pp-has-selection-bar', selectionCount > 0);

  const workflowStep = getWorkflowStep(state);

  const header = el('header', 'bulk-pp-header');
  const headerInner = el('div', 'bulk-pp-header-inner');
  const headerBrand = el('div', 'bulk-pp-header-brand');
  headerBrand.append(
    el('span', 'bulk-pp-header-eyebrow', 'Adobe Experience Manager · Edge Delivery'),
    el('h1', null, APP_TITLE),
    el('p', 'bulk-pp-header-desc', APP_DESCRIPTION),
  );
  const headerMeta = el('div', 'bulk-pp-header-meta');
  headerMeta.append(
    el('span', 'bulk-pp-badge', org),
    el('span', 'bulk-pp-badge bulk-pp-badge-muted', site),
    el('span', 'bulk-pp-badge bulk-pp-badge-muted', ref),
  );
  headerInner.append(headerBrand, headerMeta);
  header.append(headerInner, buildWorkflowStrip(workflowStep));
  root.append(header);

  const contentPanel = el('section', 'bulk-pp-panel bulk-pp-panel-content');
  const contentHead = el('div', 'bulk-pp-panel-head');
  const contentHeadMain = el('div', 'bulk-pp-panel-head-main');
  contentHeadMain.append(
    el('h2', null, 'Site content'),
    el('p', 'bulk-pp-panel-subtitle', 'Open a folder to load its pages, then select and run an operation.'),
  );
  contentHead.append(contentHeadMain);
  contentPanel.append(contentHead);
  const contentBody = el('div', 'bulk-pp-panel-body bulk-pp-content-body');

  if (contentLoading) {
    const loading = el('div', 'bulk-pp-content-loading');
    loading.append(el('p', 'bulk-pp-list-empty', 'Fetching content…'));
    contentBody.append(loading);
  } else if (error) {
    contentBody.append(el('p', 'bulk-pp-list-empty bulk-pp-list-empty-error', error));
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
      statusChecking,
    ));

    const { wrap: folderSearchField, input: folderSearchInput } = buildSearchField(
      'bulk-pp-folder-search',
      'Find a folder',
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
          : 'No subfolders here — pages in this folder are listed on the right.';
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
    contentGrid.append(folderSection);

    bindSearchInput(folderSearchInput, state, 'folder', () => {
      patchFolderSearchResults(root, state, buildFolderRow);
    });

    const pagesSection = el('section', 'bulk-pp-content-section bulk-pp-content-section-pages');
    const pageCountLabel = searchDraft && !searchTooShort
      ? `${visiblePages.length} of ${state.pages.length}`
      : String(state.pages.length);
    pagesSection.append(buildPagesHeader(state, pageCountLabel, { visiblePages, statusChecking }));
    pagesSection.append(buildPageScopeRow(state, contentLoading, statusChecking));

    if (state.pages.length > 0) {
      const panelHost = el('div', 'bulk-pp-deployment-panel-host');
      panelHost.id = 'bulk-pp-deployment-panel-host';
      panelHost.append(buildDeploymentStatusPanel(state));
      pagesSection.append(panelHost);
    }

    const controls = el('div', 'bulk-pp-pages-controls');
    const filterRow = el('div', 'bulk-pp-pages-filter-row');
    const filterField = el('div', 'bulk-pp-field bulk-pp-field-filter');
    filterField.append(el('label', null, 'Filter by deployment'));
    const filterSelect = document.createElement('select');
    filterSelect.id = 'bulk-pp-page-filter';
    const filtersLocked = statusChecking || !statusFetched;
    filterSelect.disabled = filtersLocked;
    PAGE_FILTERS.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === (pageFilter || 'all')) opt.selected = true;
      if (filtersLocked && value !== 'all') {
        opt.disabled = true;
        opt.textContent = `${label} (requires status)`;
      }
      filterSelect.append(opt);
    });
    filterField.append(filterSelect);
    filterRow.append(
      filterField,
      buildStatusLegend(),
      el(
        'p',
        'bulk-pp-pages-filter-note',
        filtersLocked
          ? 'Load deployment status to unlock filters'
          : pageScope === 'tree'
            ? 'Filters apply to all pages under this directory'
            : 'Filters apply to pages in this directory only',
      ),
    );
    controls.append(filterRow);

    const { wrap: searchField, input: searchInput } = buildSearchField(
      'bulk-pp-page-search',
      'Find a page',
      String(pageSearch || ''),
      statusChecking,
      searchHintText(pageSearch),
    );
    const searchRow = el('div', 'bulk-pp-pages-search-row');
    searchRow.append(searchField);
    controls.append(searchRow);
    pagesSection.append(controls);

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
    contentGrid.append(pagesSection);
    workspace.append(contentGrid);
    contentBody.append(workspace);

    filterSelect.addEventListener('change', () => {
      state.pageFilter = filterSelect.value;
      patchPageSearchResults(root, state, { org, site, ref }, buildPageRow);
    });
    bindSearchInput(searchInput, state, 'page', () => {
      patchPageSearchResults(root, state, { org, site, ref }, buildPageRow);
    });
    syncSelectionUI(root, state);
  }
  contentPanel.append(contentBody);
  root.append(contentPanel);
  root.append(buildSelectionActionBar(state));

  if (status && !statusChecking && statusType === 'error') {
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
  state.statusPanelNote = null;
  state.statusChecking = pathsToCheck.length > 0;
  state.statusProgressDone = 0;
  state.statusProgressTotal = pathsToCheck.length;
  state.statusFetchStartedAt = pathsToCheck.length > 0 ? Date.now() : null;
  state.statusAbort = new AbortController();

  if (pathsToCheck.length === 0) {
    state.statusChecking = false;
    state.statusFetched = false;
    resetFetchStatusOption(state);
    state.status = folderCount === 0 && docCount === 0
      ? `No folders or pages in ${location}.`
      : `Loaded ${docCount} page(s) in ${location}.`;
    state.statusType = 'info';
    render(/** @type {HTMLElement} */ (state.root), state);
    return;
  }

  refreshDeploymentUi(state);

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
      refreshDeploymentUi(state);
    },
    { signal: state.statusAbort.signal },
  ).then((platformStatus) => {
    if (state.statusAbort?.signal.aborted) return;
    state.platformStatus = platformStatus;
    state.statusChecking = false;
    state.statusFetched = true;
    state.statusAbort = null;
    state.statusFetchStartedAt = null;
    state.statusProgressDone = pathsToCheck.length;
    state.statusProgressTotal = pathsToCheck.length;
    resetFetchStatusOption(state);
    state.status = null;
    state.statusType = 'info';
    refreshDeploymentUi(state);
  }).catch((statusErr) => {
    if (statusErr instanceof DOMException && statusErr.name === 'AbortError') {
      state.statusAbort = null;
      state.statusFetchStartedAt = null;
      resetFetchStatusOption(state);
      return;
    }
    state.statusChecking = false;
    state.statusFetched = false;
    state.statusAbort = null;
    state.statusFetchStartedAt = null;
    state.statusCheckFailed = true;
    resetFetchStatusOption(state);
    state.statusError = messageFromApiError(statusErr, 'Status check failed.', 'status');
    state.status = state.statusError;
    state.statusType = 'error';
    console.warn('[bulk-pp] platform status failed', statusErr);
    refreshDeploymentUi(state);
  });
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {string} location
 * @param {number} docCount
 * @param {number} folderCount
 */
function finishContentLoadWithoutStatus(state, location, docCount, folderCount) {
  state.statusChecking = false;
  state.statusFetched = false;
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
    if (checked > 0) {
      state.statusFetched = true;
      state.statusPanelNote = `Stopped after ${checked} of ${total} pages. Showing partial results.`;
    } else {
      state.statusFetched = false;
      state.statusPanelNote = 'Status check stopped.';
    }
    refreshDeploymentUi(state);
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

  state.onCheckStatus = async () => {
    if (state.statusChecking || state.contentLoading || state.pages.length === 0) return;
    const etaHint = formatStatusFetchEta(state.pages.length);
    const ok = await confirmCheckDeploymentStatus(
      state.pages.length,
      state.pageScope,
      etaHint,
    );
    if (!ok) return;
    const location = displayFolderPath(state.folderPath) || 'site root';
    startStatusCheck(
      state,
      daFetch,
      state.pages.map((p) => p.helixPath),
      location,
      state.pages.length,
      state.folders.length,
    );
  };

  state.onScopeChange = async (scope) => {
    if (state.statusChecking || state.contentLoading) return;
    const next = scope === 'tree' ? 'tree' : 'folder';
    if (state.pageScope === next) return;
    state.pageScope = next;
    cancelStatusCheck(state, false);
    await state.onFetch(false);
  };

  state.onNavigate = async (targetPath) => {
    cancelStatusCheck(state, false);
    state.folderPath = resolveContentFolderPath(targetPath);
    state.pageSearch = '';
    state.folderSearch = '';
    state.pageFilter = 'all';
    syncUrlPath(state.ref, state.folderPath);
    await state.onFetch(true);
  };

  state.onFetch = async (fromFolderNav = false) => {
    if (state.statusChecking) return;

    if (!fromFolderNav) {
      state.pageFilter = 'all';
      state.pageSearch = '';
      state.folderSearch = '';
      state.selected.clear();
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
      state.contentLoading = false;

      if (state.pageFilter !== 'all') state.pageFilter = 'all';
      finishContentLoadWithoutStatus(
        state,
        location,
        docCount,
        state.folders.length,
      );
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

    clearPageWorkspaceAfterOperation(state);
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

    clearPageWorkspaceAfterOperation(state);
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
        console.warn('[bulk-pp] status refresh after destructive job failed', refreshErr);
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
    state.error = `Open ${APP_TITLE} from Document Authoring (https://da.live → Apps).`;
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
