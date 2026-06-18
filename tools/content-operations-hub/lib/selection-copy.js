/**
 * @param {number} count
 * @returns {string}
 */
export function formatSelectionBarText(count) {
  return count === 1 ? '1 page selected' : `${count} pages selected`;
}

/**
 * @param {number} count
 * @returns {string}
 */
export function formatShareTooltipText(count) {
  if (count === 1) return 'Copy preview URL to clipboard';
  return `Copy ${count} preview URLs to clipboard`;
}
