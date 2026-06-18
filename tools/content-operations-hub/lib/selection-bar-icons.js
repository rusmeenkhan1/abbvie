import { el } from './dom.js';

/** @type {Record<string, string>} */
export const SELECTION_OP_ICONS = {
  preview:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8s2.2-4 5.5-4 5.5 4 5.5 4-2.2 4-5.5 4-5.5-4-5.5-4Z"/><circle cx="8" cy="8" r="1.75"/></svg>',
  live: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V3.5M5 6.5 8 3.5 11 6.5"/><path d="M3.5 12.5h9"/></svg>',
  unpreview:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l10 10M6.2 6.2A3.5 3.5 0 0 0 8 11.5a3.5 3.5 0 0 0 1.8-.5"/><path d="M2.5 8s2.2-4 5.5-4c.7 0 1.3.1 1.8.3"/></svg>',
  unpublish:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 11h11M5 11V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V11"/><path d="M6.5 8h3"/></svg>',
  delete:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4.5h9M6 4.5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5.5 4.5l.5 8.5a1 1 0 0 0 1 .9h2a1 1 0 0 0 1-.9l.5-8.5"/></svg>',
  'open-da':
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6.5L9.5 2.5Z"/><path d="M9.5 2.5V6.5H13M6 9.5h4M6 11.5h2.5"/></svg>',
  'open-preview':
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5a8 8 0 0 1 0 11M8 2.5a8 8 0 0 0 0 11"/></svg>',
  'open-live':
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5l1.6 3.2 3.6.5-2.6 2.5.6 3.6L8 10.4l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5L8 2.5Z"/></svg>',
  share:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 8.2 9.6 6.4M6.5 7.8l3.1 1.8"/><circle cx="4.6" cy="8" r="1.7"/><circle cx="11.6" cy="4" r="1.7"/><circle cx="11.6" cy="12" r="1.7"/></svg>',
  'check-lhs-page':
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14h12M8 1v10M4 7l4-6 4 6"/></svg>',
  'check-lhs-live':
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14h12M8 1v10M4 7l4-6 4 6"/></svg>',
  more: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12" cy="8" r="1"/></svg>',
};

/**
 * @param {string} operationId
 */
export function buildSelectionOpIcon(operationId) {
  const icon = el('span', 'bulk-pp-selection-op-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = SELECTION_OP_ICONS[operationId] || '';
  return icon;
}
