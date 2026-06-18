import { setAccessibilityLabel } from './dom.js';

export const DA_LINK_DISABLED_MULTI = 'Use More → Open in DA when multiple pages are selected';
export const DA_LINK_DISABLED_LOCKED = 'Unavailable while status is loading';
export const DA_LINK_ENABLED = 'Open this page in DA';

/**
 * @param {HTMLAnchorElement} link
 * @param {{ disabled: boolean, href: string, reason?: 'multi' | 'locked' }} opts
 */
export function applyDaLinkState(link, { disabled, href, reason = 'locked' }) {
  link.dataset.href = href;
  if (disabled) {
    link.classList.add('bulk-pp-btn-open-da-disabled');
    link.setAttribute('aria-disabled', 'true');
    link.removeAttribute('href');
    const label = reason === 'multi' ? DA_LINK_DISABLED_MULTI : DA_LINK_DISABLED_LOCKED;
    setAccessibilityLabel(link, label);
    return;
  }
  link.classList.remove('bulk-pp-btn-open-da-disabled');
  link.removeAttribute('aria-disabled');
  link.href = href;
  link.target = '_top';
  link.rel = 'noopener noreferrer';
  setAccessibilityLabel(link, DA_LINK_ENABLED);
}
