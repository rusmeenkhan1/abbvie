import { el, setAccessibilityLabel } from './dom.js';
import {
  formatLastDeployedColumnLabel,
  formatStatusDate,
  getPageStatus,
  statusLabel,
} from './page-history.js';
import { formatPageListLabel } from './paths.js';
import { buildDaEditUrl } from './urls.js';
import { getActiveSelectionCount, getVisiblePages } from './state.js';
import { applyDaLinkState } from './da-link.js';

/**
 * @param {{ previewedAt?: number, publishedAt?: number } | undefined} entry
 * @param {boolean} showStatus
 */
export function formatRowModifiedLabel(entry, showStatus) {
  if (!showStatus) return '—';
  if (!entry) return '—';
  const ts = Math.max(entry.previewedAt || 0, entry.publishedAt || 0);
  return ts ? formatStatusDate(ts) : '—';
}

/**
 * Creates a status indicator dot with accessibility attributes.
 * @param {string} [status]
 */
export function buildStatusDot(status) {
  const isPending = !status;
  const classList = isPending
    ? 'bulk-pp-status-dot bulk-pp-status-dot-pending'
    : `bulk-pp-status-dot bulk-pp-status-dot-${status}`;
  const dot = el('span', classList);
  const label = isPending ? 'Status loading' : statusLabel(status);
  setAccessibilityLabel(dot, label);
  return dot;
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
export function buildPageListColumnHeader(state) {
  const head = el('div', 'bulk-pp-list-colhead bulk-pp-list-colhead-pages');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'bulk-pp-select-all-colhead';
  cb.className = 'bulk-pp-colhead-select-all-cb';
  cb.setAttribute('aria-label', 'Select all pages');
  cb.setAttribute('title', 'Select all pages');
  if (state) {
    const active = getActiveSelectionCount(state);
    const total = getVisiblePages(state).length;
    cb.checked = total > 0 && active === total;
    cb.indeterminate = active > 0 && active < total;
    cb.addEventListener('change', () => {
      state.onSelectAll(cb.checked);
    });
  }
  head.append(
    cb,
    el('span', 'bulk-pp-list-colhead-icon'),
    el('span', 'bulk-pp-list-colhead-name', 'Name'),
    el('span', 'bulk-pp-list-colhead-modified', formatLastDeployedColumnLabel()),
    el('span', 'bulk-pp-list-colhead-actions'),
  );
  return head;
}

/**
 * @param {import('./state.js').DocumentEntry} page
 * @param {{ previewedAt?: number, publishedAt?: number } | undefined} entry
 * @param {string} browseFolder
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {boolean} showStatus
 * @param {{ org: string, site: string, ref: string }} siteCtx
 * @param {boolean} [interactionsLocked]
 */
export function buildPageRow(
  page,
  entry,
  browseFolder,
  state,
  showStatus,
  siteCtx,
  interactionsLocked = false,
) {
  const li = el('li', 'bulk-pp-list-item bulk-pp-list-item-document');
  const cb = el('input');
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
  const { title } = formatPageListLabel(
    page.helixPath,
    page.name,
    browseFolder,
  );
  const labelWrap = el('div', 'bulk-pp-item-main');
  const label = el('label', 'bulk-pp-item-label', title);
  label.htmlFor = cb.id;
  labelWrap.append(label);

  const modifiedText = formatRowModifiedLabel(entry, showStatus);
  const modifiedEl = el('span', 'bulk-pp-item-modified', modifiedText);
  if (modifiedText === '—' && !showStatus) modifiedEl.classList.add('bulk-pp-item-modified-muted');

  const rowActions = el('div', 'bulk-pp-row-actions');
  const daUrl = buildDaEditUrl(
    siteCtx.org,
    siteCtx.site,
    page.helixPath,
    page.sourcePath,
    siteCtx.ref,
  );
  const multiSelected = getActiveSelectionCount(state) > 1;
  const daDisabled = interactionsLocked || multiSelected;
  const daLink = el('a', 'bulk-pp-btn bulk-pp-btn-open-da', 'DA');
  applyDaLinkState(daLink, {
    disabled: daDisabled,
    href: daUrl,
    reason: multiSelected ? 'multi' : 'locked',
  });
  if (daDisabled) {
    daLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  } else {
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
  rowActions.append(
    showStatus ? buildStatusDot(getPageStatus(entry)) : buildStatusDot(),
  );
  li.append(cb, icon, labelWrap, modifiedEl, rowActions);
  return li;
}
