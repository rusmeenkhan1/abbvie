import { formatRuntimeStatusEta } from './status-estimate.js';
import { el } from './dom.js';

/** @type {{ backdrop: HTMLElement, panel: HTMLElement, topic: 'preview' | 'live' } | null} */
let jobModalRef = null;

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
export function isJobModalOpen() {
  return Boolean(jobModalRef);
}

/**
 * @param {HTMLElement | null} appRoot
 */
export function closeJobModal(appRoot = null) {
  if (jobModalRef?.backdrop?.isConnected) {
    jobModalRef.backdrop.remove();
  }
  jobModalRef = null;
  clearAppModalOpen(appRoot);
}

/**
 * @param {'preview'|'live'} topic
 * @param {number} pageCount
 */
function jobModalTitle(topic, pageCount) {
  const noun = pageCount === 1 ? '1 page' : `${pageCount} pages`;
  if (topic === 'live') return `Publishing ${noun} to production`;
  return `Running bulk preview on ${noun}`;
}

/**
 * @param {'preview'|'live'} topic
 * @param {number} pageCount
 */
function jobModalIntro(topic, pageCount) {
  const noun = pageCount === 1 ? 'page' : 'pages';
  if (topic === 'live') {
    return `Publishing ${pageCount} ${noun} to the live site (.aem.live). You can cancel at any time; the job may continue on the server.`;
  }
  return `Creating preview deployments for ${pageCount} ${noun} (.aem.page). You can cancel at any time; the job may continue on the server.`;
}

/**
 * @param {HTMLElement | null} appRoot
 * @param {'preview'|'live'} topic
 * @param {number} pageCount
 * @param {() => void} onCancel
 */
export function openJobModal(appRoot, topic, pageCount, onCancel) {
  closeJobModal(appRoot);

  const backdrop = el('div', 'bulk-pp-modal-backdrop bulk-pp-status-modal-backdrop');
  backdrop.setAttribute('role', 'presentation');

  const dialog = el('div', 'bulk-pp-modal bulk-pp-status-modal');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'bulk-pp-job-modal-title');

  const head = el('div', 'bulk-pp-status-modal-head');
  const titleEl = el('h2', 'bulk-pp-status-modal-title', jobModalTitle(topic, pageCount));
  titleEl.id = 'bulk-pp-job-modal-title';
  head.append(titleEl);
  const cancelBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-cancel bulk-pp-status-modal-cancel', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.id = 'bulk-pp-job-modal-cancel';
  cancelBtn.addEventListener('click', onCancel);
  head.append(cancelBtn);

  const body = el('div', 'bulk-pp-status-modal-body');
  body.id = 'bulk-pp-job-modal-body';
  body.append(el('p', 'bulk-pp-status-modal-intro', jobModalIntro(topic, pageCount)));

  const track = el('div', 'bulk-pp-progress-track');
  const fill = el('div', 'bulk-pp-progress-fill');
  fill.id = 'bulk-pp-job-modal-progress-fill';
  fill.style.width = '0%';
  track.append(fill);

  body.append(track);
  body.append(el('p', 'bulk-pp-progress-label', 'Starting…'));
  body.querySelector('.bulk-pp-progress-label').id = 'bulk-pp-job-modal-progress-label';
  const eta = el('p', 'bulk-pp-progress-eta', '');
  eta.id = 'bulk-pp-job-modal-progress-eta';
  body.append(eta);

  dialog.append(head, body);
  backdrop.append(dialog);
  document.body.append(backdrop);
  jobModalRef = { backdrop, panel: body, topic };
  setAppModalOpen(appRoot);
}

/**
 * @param {{
 *   jobStartedAt: number | null,
 *   processed: number,
 *   total: number,
 *   failed: number,
 *   stateLabel?: string,
 * }} opts
 */
export function updateJobModal(opts) {
  if (!jobModalRef) return;
  const {
    jobStartedAt,
    processed,
    total,
    failed,
    stateLabel = 'running',
  } = opts;
  const fill = document.getElementById('bulk-pp-job-modal-progress-fill');
  const label = document.getElementById('bulk-pp-job-modal-progress-label');
  const etaEl = document.getElementById('bulk-pp-job-modal-progress-eta');
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  if (fill instanceof HTMLElement) fill.style.width = `${pct}%`;
  if (label) {
    const failNote = failed > 0 ? ` · ${failed} failed` : '';
    label.textContent = total > 0
      ? `${processed} of ${total} pages processed (${pct}%)${failNote} · ${stateLabel}`
      : `Job ${stateLabel}…`;
  }
  if (etaEl) {
    const runtime = formatRuntimeStatusEta(jobStartedAt, processed, total);
    etaEl.textContent = runtime || '';
  }
}

/**
 * @param {{
 *   summary: string,
 *   topic: 'preview'|'live',
 *   urlCount?: number,
 *   onViewUrls: () => void,
 *   onClose: () => void,
 * }} opts
 */
export function showJobCompleteModal(opts) {
  if (!jobModalRef) return;
  const { summary, topic, urlCount = 0, onViewUrls, onClose } = opts;
  const { panel } = jobModalRef;
  panel.replaceChildren();

  panel.append(el('p', 'bulk-pp-status-modal-success-icon', '✓'));
  const title = topic === 'live' ? 'Publish complete' : 'Preview complete';
  panel.append(el('h3', 'bulk-pp-status-modal-complete-title', title));
  panel.append(el('p', 'bulk-pp-status-modal-summary', summary));
  panel.append(el(
    'p',
    'bulk-pp-status-modal-hint',
    urlCount > 0
      ? 'View generated URLs on the Urls tab, or close to continue browsing.'
      : 'Close to continue browsing.',
  ));

  const actions = el('div', 'bulk-pp-status-modal-actions');
  const viewBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-confirm', 'View URLs');
  const closeBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-cancel', 'Close');
  viewBtn.type = 'button';
  closeBtn.type = 'button';
  viewBtn.disabled = urlCount === 0;
  if (urlCount === 0) viewBtn.title = 'No URLs available for this operation';
  viewBtn.addEventListener('click', () => {
    if (viewBtn.disabled) return;
    Promise.resolve(onViewUrls()).catch(() => {});
  });
  closeBtn.addEventListener('click', onClose);
  actions.append(viewBtn, closeBtn);
  panel.append(actions);

  const headTitle = jobModalRef.backdrop.querySelector('.bulk-pp-status-modal-title');
  if (headTitle) headTitle.textContent = topic === 'live' ? 'Publish finished' : 'Preview finished';
  const cancelBtn = document.getElementById('bulk-pp-job-modal-cancel');
  if (cancelBtn) cancelBtn.hidden = true;
}

/**
 * @param {{
 *   message: string,
 *   topic: 'preview'|'live',
 *   onClose: () => void,
 * }} opts
 */
export function showJobErrorModal(opts) {
  if (!jobModalRef) return;
  const { message, topic, onClose } = opts;
  const { panel } = jobModalRef;
  panel.replaceChildren();
  const title = topic === 'live' ? 'Publish failed' : 'Preview failed';
  panel.append(el('h3', 'bulk-pp-status-modal-complete-title bulk-pp-status-modal-error-title', title));
  panel.append(el('p', 'bulk-pp-status-modal-summary bulk-pp-status-modal-error', message));
  const actions = el('div', 'bulk-pp-status-modal-actions');
  const closeBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-cancel', 'Close');
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', onClose);
  actions.append(closeBtn);
  panel.append(actions);

  const headTitle = jobModalRef.backdrop.querySelector('.bulk-pp-status-modal-title');
  if (headTitle) headTitle.textContent = topic === 'live' ? 'Could not publish' : 'Could not preview';
  const cancelBtn = document.getElementById('bulk-pp-job-modal-cancel');
  if (cancelBtn) cancelBtn.hidden = true;
}

/**
 * @param {{
 *   message: string,
 *   topic: 'preview'|'live',
 *   onClose: () => void,
 * }} opts
 */
export function showJobCancelledModal(opts) {
  if (!jobModalRef) return;
  const { message, topic, onClose } = opts;
  const { panel } = jobModalRef;
  panel.replaceChildren();
  panel.append(el('h3', 'bulk-pp-status-modal-complete-title', 'Operation cancelled'));
  panel.append(el('p', 'bulk-pp-status-modal-summary', message));
  const actions = el('div', 'bulk-pp-status-modal-actions');
  const closeBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-cancel', 'Close');
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', onClose);
  actions.append(closeBtn);
  panel.append(actions);

  const headTitle = jobModalRef.backdrop.querySelector('.bulk-pp-status-modal-title');
  if (headTitle) headTitle.textContent = topic === 'live' ? 'Publish stopped' : 'Preview stopped';
  const cancelBtn = document.getElementById('bulk-pp-job-modal-cancel');
  if (cancelBtn) cancelBtn.hidden = true;
}
