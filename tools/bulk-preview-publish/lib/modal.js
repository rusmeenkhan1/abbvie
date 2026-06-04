import { el } from './dom.js?t=mpyxlouk';

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
    title: 'Fetch all subfolders?',
    body: 'Loading every page under this folder and checking preview/publish status can take several minutes on large sites. You can cancel the status check at any time.',
    confirmLabel: 'Continue',
    cancelLabel: 'Cancel',
    variant: 'warning',
  });
}
