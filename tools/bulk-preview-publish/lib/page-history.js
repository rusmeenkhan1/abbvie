/**
 * @typedef {{ previewedAt?: number, publishedAt?: number }} PageHistoryEntry
 * @typedef {Record<string, PageHistoryEntry>} HistoryMap
 */

/**
 * @param {HistoryMap} history
 * @param {string[]} paths
 * @param {'preview'|'live'} type
 * @returns {HistoryMap}
 */
export function recordPaths(history, paths, type) {
  const now = Date.now();
  const next = { ...history };
  paths.forEach((path) => {
    const entry = { ...(next[path] || {}) };
    if (type === 'preview') entry.previewedAt = now;
    else entry.publishedAt = now;
    next[path] = entry;
  });
  return next;
}

/**
 * @param {PageHistoryEntry | undefined} entry
 * @returns {'published'|'previewed'|'untouched'}
 */
export function getPageStatus(entry) {
  if (entry?.publishedAt) return 'published';
  if (entry?.previewedAt) return 'previewed';
  return 'untouched';
}

/** @type {ReadonlyArray<[string, string]>} */
export const PAGE_FILTERS = [
  ['all', 'All pages'],
  ['never-previewed', 'Never previewed'],
  ['never-published', 'Never published'],
  ['recent-preview', 'Recently previewed'],
  ['recent-publish', 'Recently published'],
  ['oldest-preview', 'Oldest previewed'],
  ['oldest-publish', 'Oldest published'],
];

import { sortPagesByListPath } from './paths.js?v=22';

const DATE_SORT_FILTERS = new Set([
  'recent-preview',
  'recent-publish',
  'oldest-preview',
  'oldest-publish',
]);

/**
 * @param {{ helixPath: string }[]} pages
 * @param {HistoryMap} history
 * @param {string} filterId
 * @param {string} [browseFolder]
 * @returns {{ helixPath: string }[]}
 */
export function filterAndSortPages(pages, history, filterId, browseFolder = '') {
  if (filterId === 'all') return sortPagesByListPath(pages, browseFolder);

  const withMeta = pages.map((page) => ({
    page,
    entry: history[page.helixPath] || {},
  }));

  /** @type {typeof withMeta} */
  let filtered;

  switch (filterId) {
    case 'never-previewed':
      filtered = withMeta.filter((m) => !m.entry.previewedAt);
      break;
    case 'never-published':
      filtered = withMeta.filter((m) => !m.entry.publishedAt);
      break;
    case 'recent-preview':
      filtered = withMeta.filter((m) => m.entry.previewedAt);
      filtered.sort((a, b) => (b.entry.previewedAt || 0) - (a.entry.previewedAt || 0));
      break;
    case 'recent-publish':
      filtered = withMeta.filter((m) => m.entry.publishedAt);
      filtered.sort((a, b) => (b.entry.publishedAt || 0) - (a.entry.publishedAt || 0));
      break;
    case 'oldest-preview':
      filtered = withMeta.filter((m) => m.entry.previewedAt);
      filtered.sort((a, b) => (a.entry.previewedAt || 0) - (b.entry.previewedAt || 0));
      break;
    case 'oldest-publish':
      filtered = withMeta.filter((m) => m.entry.publishedAt);
      filtered.sort((a, b) => (a.entry.publishedAt || 0) - (b.entry.publishedAt || 0));
      break;
    default:
      return sortPagesByListPath(pages, browseFolder);
  }

  const result = filtered.map((m) => m.page);
  if (!DATE_SORT_FILTERS.has(filterId)) {
    return sortPagesByListPath(result, browseFolder);
  }
  return result;
}

/**
 * @param {number | undefined} ts
 * @returns {string}
 */
export function formatStatusDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * @param {'published'|'previewed'|'untouched'} status
 * @returns {string}
 */
export function statusLabel(status) {
  if (status === 'published') return 'Published';
  if (status === 'previewed') return 'On preview';
  return 'Not deployed';
}
