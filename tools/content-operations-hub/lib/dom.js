/** Stable element ids used across the hub UI. */
export const DOM_IDS = {
  PAGE_FILTER: 'bulk-pp-page-filter',
  SELECTION_BAR: 'bulk-pp-selection-bar',
  SELECTION_COUNT: 'bulk-pp-selection-count',
  SELECTION_CLEAR: 'bulk-pp-selection-clear',
  SELECTION_SHARE: 'bulk-pp-selection-share',
  SELECTION_SHARE_TOOLTIP: 'bulk-pp-selection-share-tooltip',
  PAGES_SUMMARY: 'bulk-pp-pages-summary',
  PAGES_STATUS_LOADING: 'bulk-pp-pages-status-loading',
  SELECT_ALL_COLHEAD: 'bulk-pp-select-all-colhead',
};

/** Common query selectors for patch/render helpers. */
export const DOM_SELECTORS = {
  PAGE_FILTER: `#${DOM_IDS.PAGE_FILTER}`,
  PAGES_HEADER: '.bulk-pp-pages-header',
  PAGES_STATUS_LOADING: `#${DOM_IDS.PAGES_STATUS_LOADING}`,
};

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Sets accessibility label and title for consistent a11y across elements.
 * @param {HTMLElement} element
 * @param {string} label
 * @returns {HTMLElement}
 */
export function setAccessibilityLabel(element, label) {
  element.setAttribute('aria-label', label);
  element.title = label;
  return element;
}

/**
 * Safely query element by selector and type.
 * @template {HTMLElement} T
 * @param {HTMLElement | null} root
 * @param {string} selector
 * @param {new(...args: any[]) => T} [constructor]
 * @returns {T | null}
 */
export function safeQuery(root, selector, constructor = HTMLElement) {
  if (!root) return null;
  const element = root.querySelector(selector);
  return element instanceof constructor ? element : null;
}
