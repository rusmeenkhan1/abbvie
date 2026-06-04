import { formatRuntimeStatusEta, formatStatusFetchEta } from './status-estimate.js';
import { el } from './dom.js';

/** @type {{ backdrop: HTMLElement, panel: HTMLElement } | null} */
let statusModalRef = null;

/**
 * @param {HTMLElement | null} appRoot
 */
function setAppModalOpen(appRoot) {
  if (appRoot) appRoot.classList.add('bulk-pp-modal-open');
}

/**
 * @param {HTMLElement | null} appRoot
 */
function clearAppModalOpen(appRoot) {
  if (appRoot) appRoot.classList.remove('bulk-pp-modal-open');
}

/**
 * @returns {boolean}
 */
export function isStatusFetchModalOpen() {
  return Boolean(statusModalRef);
}

/**
 * @param {HTMLElement | null} appRoot
 */
export function closeStatusFetchModal(appRoot = null) {
  if (statusModalRef?.backdrop?.isConnected) {
    statusModalRef.backdrop.remove();
  }
  statusModalRef = null;
  clearAppModalOpen(appRoot);
}

/**
 * @param {HTMLElement | null} appRoot
 * @param {{ statusProgressTotal: number }} state
 * @param {() => void} onCancel
 */
export function openStatusFetchModal(appRoot, state, onCancel) {
  closeStatusFetchModal(appRoot);

  const backdrop = el('div', 'bulk-pp-modal-backdrop bulk-pp-status-modal-backdrop');
  backdrop.setAttribute('role', 'presentation');

  const dialog = el('div', 'bulk-pp-modal bulk-pp-status-modal');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'bulk-pp-status-modal-title');

  const head = el('div', 'bulk-pp-status-modal-head');
  head.append(el('h2', 'bulk-pp-status-modal-title', 'Fetching deployment status'));
  const cancelBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-cancel bulk-pp-status-modal-cancel', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.id = 'bulk-pp-status-modal-cancel';
  cancelBtn.hidden = false;
  cancelBtn.addEventListener('click', onCancel);
  head.append(cancelBtn);

  const body = el('div', 'bulk-pp-status-modal-body');
  body.id = 'bulk-pp-status-modal-body';

  const etaText = formatStatusFetchEta(state.statusProgressTotal);
  const intro = el(
    'p',
    'bulk-pp-status-modal-intro',
    etaText
      ? `Checking preview and publish status from AEM. Estimated time: ${etaText}.`
      : 'Checking preview and publish status from AEM.',
  );
  body.append(intro);

  const track = el('div', 'bulk-pp-progress-track');
  const fill = el('div', 'bulk-pp-progress-fill');
  fill.id = 'bulk-pp-status-modal-progress-fill';
  fill.style.width = '0%';
  track.append(fill);

  body.append(track);
  body.append(el('p', 'bulk-pp-progress-label', 'Starting…'));
  body.querySelector('.bulk-pp-progress-label').id = 'bulk-pp-status-modal-progress-label';
  const eta = el('p', 'bulk-pp-progress-eta', '');
  eta.id = 'bulk-pp-status-modal-progress-eta';
  body.append(eta);

  dialog.append(head, body);
  backdrop.append(dialog);
  document.body.append(backdrop);
  statusModalRef = { backdrop, panel: body };
  setAppModalOpen(appRoot);
}

/**
 * @param {{
 *   statusFetchStartedAt: number | null,
 *   statusProgressDone: number,
 *   statusProgressTotal: number,
 * }} state
 */
export function updateStatusFetchModal(state) {
  if (!statusModalRef) return;
  const fill = document.getElementById('bulk-pp-status-modal-progress-fill');
  const label = document.getElementById('bulk-pp-status-modal-progress-label');
  const etaEl = document.getElementById('bulk-pp-status-modal-progress-eta');
  const pct = state.statusProgressTotal > 0
    ? Math.min(100, Math.round((state.statusProgressDone / state.statusProgressTotal) * 100))
    : 0;
  if (fill instanceof HTMLElement) fill.style.width = `${pct}%`;
  if (label) {
    label.textContent = `${state.statusProgressDone} of ${state.statusProgressTotal} pages checked (${pct}%)`;
  }
  if (etaEl) {
    const runtime = formatRuntimeStatusEta(
      state.statusFetchStartedAt,
      state.statusProgressDone,
      state.statusProgressTotal,
    );
    const fallback = formatStatusFetchEta(state.statusProgressTotal);
    etaEl.textContent = runtime || (fallback ? `Estimated time: ${fallback}` : '');
  }
}

/**
 * @param {{
 *   summary: string,
 *   urlCount?: number,
 *   onOpenUrls: () => void | Promise<void>,
 *   onClose: () => void,
 * }} opts
 */
export function showStatusFetchCompleteModal(opts) {
  if (!statusModalRef) return;
  const { summary, urlCount = 0, onOpenUrls, onClose } = opts;
  const { panel } = statusModalRef;
  panel.replaceChildren();

  panel.append(el('p', 'bulk-pp-status-modal-success-icon', '✓'));
  panel.append(el('h3', 'bulk-pp-status-modal-complete-title', 'Status check complete'));
  panel.append(el('p', 'bulk-pp-status-modal-summary', summary));
  panel.append(el(
    'p',
    'bulk-pp-status-modal-hint',
    urlCount > 0
      ? `Open ${urlCount} preview and live URL${urlCount === 1 ? '' : 's'}, or close to continue browsing.`
      : 'No preview or live URLs were found for this page list. Close to continue browsing.',
  ));

  const actions = el('div', 'bulk-pp-status-modal-actions');
  const openBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-confirm', 'Open URLs');
  const closeBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-cancel', 'Close');
  openBtn.type = 'button';
  closeBtn.type = 'button';
  openBtn.disabled = urlCount === 0;
  if (urlCount === 0) openBtn.title = 'No deployed preview or live URLs to open';
  openBtn.addEventListener('click', () => {
    if (openBtn.disabled) return;
    Promise.resolve(onOpenUrls()).catch(() => {});
  });
  closeBtn.addEventListener('click', onClose);
  actions.append(openBtn, closeBtn);
  panel.append(actions);

  const title = statusModalRef.backdrop.querySelector('.bulk-pp-status-modal-title');
  if (title) title.textContent = 'Deployment status ready';
  const cancelBtn = document.getElementById('bulk-pp-status-modal-cancel');
  if (cancelBtn) cancelBtn.hidden = true;
}

/**
 * @param {{
 *   message: string,
 *   onClose: () => void,
 * }} opts
 */
export function showStatusFetchErrorModal(opts) {
  if (!statusModalRef) return;
  const { message, onClose } = opts;
  const { panel } = statusModalRef;
  panel.replaceChildren();
  panel.append(el('h3', 'bulk-pp-status-modal-complete-title bulk-pp-status-modal-error-title', 'Status check failed'));
  panel.append(el('p', 'bulk-pp-status-modal-summary bulk-pp-status-modal-error', message));
  const actions = el('div', 'bulk-pp-status-modal-actions');
  const closeBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-cancel', 'Close');
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', onClose);
  actions.append(closeBtn);
  panel.append(actions);

  const title = statusModalRef.backdrop.querySelector('.bulk-pp-status-modal-title');
  if (title) title.textContent = 'Could not load status';
  const cancelBtn = document.getElementById('bulk-pp-status-modal-cancel');
  if (cancelBtn) cancelBtn.hidden = true;
}
