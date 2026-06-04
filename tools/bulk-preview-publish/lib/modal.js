import { el } from './dom.js';

/**
 * @param {{
 *   title: string,
 *   body: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   variant?: 'warning' | 'default',
 * }} opts
 * @returns {Promise<boolean>}
 */
export function showConfirmModal(opts) {
  const {
    title,
    body,
    confirmLabel = 'Continue',
    cancelLabel = 'Cancel',
    variant = 'default',
  } = opts;

  return new Promise((resolve) => {
    const backdrop = el('div', 'bulk-pp-modal-backdrop');
    backdrop.setAttribute('role', 'presentation');

    const dialog = el('div', `bulk-pp-modal bulk-pp-modal-${variant}`);
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'bulk-pp-modal-title');

    const head = el('div', 'bulk-pp-modal-head');
    if (variant === 'warning') {
      head.append(el('span', 'bulk-pp-modal-icon', '!'));
    }
    const titleWrap = el('div', 'bulk-pp-modal-title-wrap');
    titleWrap.append(el('h2', 'bulk-pp-modal-title', title));
    head.append(titleWrap);
    head.id = 'bulk-pp-modal-title';

    const content = el('p', 'bulk-pp-modal-body', body);

    const actions = el('div', 'bulk-pp-modal-actions');
    const cancelBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-cancel', cancelLabel);
    const confirmBtn = el('button', 'bulk-pp-modal-btn bulk-pp-modal-btn-confirm', confirmLabel);
    cancelBtn.type = 'button';
    confirmBtn.type = 'button';
    actions.append(cancelBtn, confirmBtn);

    dialog.append(head, content, actions);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const close = (result) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
    };

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });
    document.addEventListener('keydown', onKey);
    confirmBtn.focus();
  });
}

/**
 * @returns {Promise<boolean>}
 */
export function confirmTreeScopeFetch() {
  return showConfirmModal({
    title: 'Load status for all subfolders?',
    body: 'You chose to load preview/publish status for every page under this folder. On large sites that can take several minutes. You can cancel the status check at any time.',
    confirmLabel: 'Continue',
    cancelLabel: 'Cancel',
    variant: 'warning',
  });
}

/**
 * @param {number} count
 * @returns {Promise<boolean>}
 */
export function confirmOpenUrlsInNewTabs(count) {
  const tabLabel = count === 1 ? '1 tab' : `${count} tabs`;
  const scaleNote = count >= 20
    ? ' Large lists often trigger popup blockers or slow the browser.'
    : count >= 5
      ? ' Some browsers may block or limit how many tabs open at once.'
      : '';
  return showConfirmModal({
    title: 'Open URLs in new tabs?',
    body: `This will try to open ${count} URL${count === 1 ? '' : 's'} (${tabLabel}).${scaleNote} Continue only if you intend to review that many pages.`,
    confirmLabel: `Open ${tabLabel}`,
    cancelLabel: 'Cancel',
    variant: 'warning',
  });
}
