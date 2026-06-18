/* eslint-disable no-void, max-len */

import { confirmOpenUrlsInNewTabs } from './modal.js';
import { messageFromApiError } from './api.js';
import { copyTextToClipboard, openUrlsInNewTabsQuiet, shouldWarnPopupBlock } from './ui-utils.js';
import { buildUrlsForPaths, buildDaEditUrl } from './urls.js';
import {
  getActiveSelectionCount,
  getSelectedHelixPaths,
  isUiActionsBlocked,
} from './state.js';
import { el, setAccessibilityLabel, DOM_IDS } from './dom.js';
import { TIMING } from './constants.js';
import { formatSelectionBarText, formatShareTooltipText } from './selection-copy.js';
import { appHooks } from './app-hooks.js';
import { buildSelectionOpIcon } from './selection-bar-icons.js';

/** @typedef {import('./state.js').PageOperationId} PageOperationId */

/** @type {{ id: PageOperationId, label: string, variant: 'deploy' | 'primary' }[]} */
const SELECTION_STRIP_OPS = [
  { id: 'preview', label: 'Preview', variant: 'deploy' },
  { id: 'live', label: 'Publish', variant: 'primary' },
];

/** @type {{ title: string, items: { id: PageOperationId, label: string, danger?: boolean }[] }[]} */
const MORE_SELECTION_GROUPS = [
  {
    title: 'Open',
    items: [
      { id: 'open-da', label: 'Open in DA' },
      { id: 'open-preview', label: 'Open preview URLs (.page)' },
      { id: 'open-live', label: 'Open published URLs (.live)' },
    ],
  },
  {
    title: 'Performance',
    items: [
      { id: 'check-lhs-page', label: 'PageSpeed — preview URLs' },
      { id: 'check-lhs-live', label: 'PageSpeed — published URLs' },
    ],
  },
  {
    title: 'Unpublish',
    items: [
      { id: 'unpreview', label: 'Unpreview' },
      { id: 'unpublish', label: 'Unpublish' },
    ],
  },
  {
    title: 'Remove content',
    items: [
      { id: 'delete', label: 'Delete from DA', danger: true },
    ],
  },
];

let copyToastTimer = 0;

/**
 * @param {string} title
 * @param {string} message
 */
export function showCopyToast(title, message) {
  const existing = document.querySelector('.bulk-pp-copy-toast');
  if (existing) existing.remove();
  if (copyToastTimer) window.clearTimeout(copyToastTimer);

  const toast = el('div', 'bulk-pp-copy-toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const head = el('div', 'bulk-pp-copy-toast-head');
  const icon = el('span', 'bulk-pp-copy-toast-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5 7-7"/></svg>';
  head.append(icon, el('span', 'bulk-pp-copy-toast-title', title));
  toast.append(head, el('p', 'bulk-pp-copy-toast-message', message));

  const stripAnchor = document.getElementById(DOM_IDS.SELECTION_BAR);
  if (stripAnchor && !stripAnchor.hidden) {
    stripAnchor.append(toast);
  } else {
    toast.classList.add('bulk-pp-copy-toast-fallback');
    document.body.append(toast);
  }
  copyToastTimer = window.setTimeout(() => {
    toast.remove();
    copyToastTimer = 0;
  }, TIMING.COPY_TOAST_MS);
}

/**
 * @param {string[]} urls
 * @param {ReturnType<typeof import('./state.js').createAppState>} [state]
 */
export async function openUrlsInNewTabs(urls, state = null) {
  if (urls.length === 0) return;
  const ok = await confirmOpenUrlsInNewTabs(urls.length);
  if (!ok) return;
  if (state && appHooks.applyOperationWorkspaceReset) {
    appHooks.applyOperationWorkspaceReset(state);
  }
  const result = openUrlsInNewTabsQuiet(urls);
  if (shouldWarnPopupBlock(result) && state && appHooks.render && state.root) {
    state.status = 'Your browser blocked new tabs. Allow pop-ups for this site, or copy URLs from the operation completion dialog.';
    state.statusType = 'error';
    appHooks.render(/** @type {HTMLElement} */ (state.root), state);
  }
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
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
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {'preview'|'live'} env
 */
async function openSelectedUrls(state, env) {
  await openEnvUrls(state, env, getSelectedHelixPaths(state));
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
async function copySelectedPreviewUrls(state) {
  const paths = getSelectedHelixPaths(state);
  if (paths.length === 0) return;
  const urls = buildUrlsForPaths(
    paths,
    state.org,
    state.site,
    state.ref,
    'preview',
  );
  try {
    await copyTextToClipboard(urls.join('\n'));
    showCopyToast(
      'Copied to clipboard',
      `${urls.length} preview ${urls.length === 1 ? 'URL' : 'URLs'} ready to paste.`,
    );
  } catch {
    state.status = 'Unable to copy preview URLs. Check clipboard permissions and try again.';
    state.statusType = 'error';
    if (appHooks.render && state.root) {
      appHooks.render(/** @type {HTMLElement} */ (state.root), state);
    }
  }
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
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
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {'preview'|'live'} env
 */
async function checkLhsForSelectedUrls(state, env) {
  const paths = getSelectedHelixPaths(state);
  if (paths.length === 0) return;
  const contentUrls = buildUrlsForPaths(paths, state.org, state.site, state.ref, env);
  const psUrls = contentUrls.map((url) => {
    const encoded = encodeURIComponent(url);
    return `https://pagespeed.web.dev/analysis?url=${encoded}`;
  });
  await openUrlsInNewTabs(psUrls, state);
}

/**
 * @param {PageOperationId} operationId
 * @returns {import('./api.js').AdminOperation | ''}
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
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {PageOperationId} operationId
 */
export async function runPageOperation(state, operationId) {
  if (isUiActionsBlocked(state, { requireSelection: true })) return;

  try {
    if (operationId === 'preview' || operationId === 'live') {
      await state.onRun(operationId);
      return;
    }
    if (
      operationId === 'unpreview'
      || operationId === 'unpublish'
      || operationId === 'delete'
    ) {
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
      return;
    }
    if (operationId === 'check-lhs-page') {
      await checkLhsForSelectedUrls(state, 'preview');
      return;
    }
    if (operationId === 'check-lhs-live') {
      await checkLhsForSelectedUrls(state, 'live');
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    const op = operationApiKey(operationId);
    const msg = messageFromApiError(err, 'Operation failed.', op);
    state.status = msg;
    state.statusType = 'error';
    const { root } = state;
    if (root && appHooks.render) appHooks.render(/** @type {HTMLElement} */ (root), state);
  }
}

/**
 * @param {HTMLButtonElement} btn
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {PageOperationId} operationId
 * @param {string} label
 * @param {'default' | 'deploy' | 'primary'} [variant]
 */
function bindSelectionOpButton(
  btn,
  state,
  operationId,
  label,
  variant = 'default',
) {
  btn.type = 'button';
  btn.dataset.operation = operationId;
  btn.classList.add(
    'bulk-pp-selection-strip-btn',
    `bulk-pp-selection-strip-btn-${variant}`,
  );
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
 * @param {HTMLElement} menuWrap
 * @param {HTMLElement} menuTrigger
 * @param {HTMLElement} menu
 * @param {number} [closeDelay]
 */
function attachMenuManager(
  menuWrap,
  menuTrigger,
  menu,
  closeDelay = TIMING.MENU_CLOSE_DELAY_MS,
) {
  let closeTimer = null;

  const openMenu = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    menu.classList.add('bulk-pp-selection-more-menu-open');
    menuTrigger.setAttribute('aria-expanded', 'true');
  };

  const scheduleClose = () => {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      menu.classList.remove('bulk-pp-selection-more-menu-open');
      menuTrigger.setAttribute('aria-expanded', 'false');
      closeTimer = null;
    }, closeDelay);
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (menu.classList.contains('bulk-pp-selection-more-menu-open')) {
      scheduleClose();
    } else {
      openMenu();
    }
  };

  menuWrap.addEventListener('mouseenter', openMenu);
  menuWrap.addEventListener('mouseleave', scheduleClose);
  menuWrap.addEventListener('focusin', openMenu);
  menuWrap.addEventListener('focusout', (e) => {
    if (!menuWrap.contains(/** @type {Node} */ (e.relatedTarget))) {
      scheduleClose();
    }
  });
  menuTrigger.addEventListener('click', toggleMenu);
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
export function buildSelectionActionBar(state) {
  const count = getActiveSelectionCount(state);
  const blocked = isUiActionsBlocked(state);
  const anchor = el('div', 'bulk-pp-selection-strip-anchor');
  anchor.id = DOM_IDS.SELECTION_BAR;
  if (count === 0) anchor.hidden = true;

  const bar = el('div', 'bulk-pp-selection-strip');
  bar.setAttribute('role', 'toolbar');
  setAccessibilityLabel(bar, 'Actions for selected pages');

  const left = el('div', 'bulk-pp-selection-strip-left');
  const badge = el('div', 'bulk-pp-selection-strip-badge');

  const dismissBtn = el('button', 'bulk-pp-selection-dismiss');
  dismissBtn.type = 'button';
  dismissBtn.id = DOM_IDS.SELECTION_CLEAR;
  dismissBtn.innerHTML = '<span class="bulk-pp-selection-dismiss-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg></span>';
  setAccessibilityLabel(dismissBtn, 'Clear selection');
  dismissBtn.addEventListener('click', () => {
    state.selected.clear();
    state.onSelectionChange();
  });

  const countEl = el(
    'span',
    'bulk-pp-selection-count',
    formatSelectionBarText(count),
  );
  countEl.id = DOM_IDS.SELECTION_COUNT;
  badge.append(dismissBtn, countEl);

  const shareWrap = el('div', 'bulk-pp-selection-share-wrap');
  const shareBtn = el(
    'button',
    'bulk-pp-selection-strip-btn bulk-pp-selection-strip-btn-share',
    '',
  );
  shareBtn.type = 'button';
  shareBtn.id = DOM_IDS.SELECTION_SHARE;
  setAccessibilityLabel(shareBtn, formatShareTooltipText(count));
  shareBtn.disabled = blocked;
  shareBtn.append(
    buildSelectionOpIcon('share'),
    el('span', 'bulk-pp-selection-op-label', 'Share'),
  );
  shareBtn.addEventListener('click', () => {
    void copySelectedPreviewUrls(state);
  });
  const shareTip = el(
    'span',
    'bulk-pp-selection-share-tooltip',
    formatShareTooltipText(count),
  );
  shareTip.id = DOM_IDS.SELECTION_SHARE_TOOLTIP;
  shareWrap.append(shareBtn, shareTip);
  left.append(badge);

  const actions = el('div', 'bulk-pp-selection-strip-actions');
  const deployGroup = el(
    'div',
    'bulk-pp-selection-strip-group bulk-pp-selection-strip-group-deploy',
  );
  SELECTION_STRIP_OPS.forEach(({ id, label, variant }) => {
    const btn = el('button');
    bindSelectionOpButton(btn, state, id, label, variant);
    btn.disabled = blocked;
    deployGroup.append(btn);
  });
  actions.append(deployGroup, shareWrap);

  const moreWrap = el('div', 'bulk-pp-selection-more-wrap');
  const moreBtn = el(
    'button',
    'bulk-pp-selection-strip-btn bulk-pp-selection-more-trigger',
    '',
  );
  moreBtn.type = 'button';
  moreBtn.id = 'bulk-pp-selection-more';
  moreBtn.setAttribute('aria-haspopup', 'true');
  moreBtn.setAttribute('aria-expanded', 'false');
  setAccessibilityLabel(moreBtn, 'More page operations');
  moreBtn.disabled = blocked;
  moreBtn.append(el('span', 'bulk-pp-selection-op-label', 'More'));

  const menu = el('div', 'bulk-pp-selection-more-menu');
  menu.setAttribute('role', 'menu');
  const menuPanel = el('div', 'bulk-pp-selection-more-menu-panel');
  MORE_SELECTION_GROUPS.forEach(({ title, items }, groupIndex) => {
    if (groupIndex > 0) {
      menuPanel.append(el('div', 'bulk-pp-selection-more-divider'));
    }
    menuPanel.append(el('div', 'bulk-pp-selection-more-section-title', title));
    items.forEach(({ id, label, danger }) => {
      const item = el('button', 'bulk-pp-selection-more-item');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      if (danger) item.classList.add('bulk-pp-selection-more-item-danger');
      item.disabled = blocked;
      item.append(
        buildSelectionOpIcon(id),
        el('span', 'bulk-pp-selection-more-item-label', label),
      );
      item.addEventListener('click', () => {
        void runPageOperation(state, id);
        moreBtn.setAttribute('aria-expanded', 'false');
        menu.classList.remove('bulk-pp-selection-more-menu-open');
      });
      menuPanel.append(item);
    });
  });
  menu.append(menuPanel);

  attachMenuManager(moreWrap, moreBtn, menu);

  moreWrap.append(moreBtn, menu);
  actions.append(el('div', 'bulk-pp-selection-strip-divider'), moreWrap);
  bar.append(left, actions);
  anchor.append(bar);
  return anchor;
}
