const STORAGE_PREFIX = 'bulk-pp-history';

/**
 * @typedef {{ previewedAt?: number, publishedAt?: number }} PageHistoryEntry
 * @typedef {Record<string, PageHistoryEntry>} HistoryMap
 */

/**
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 */
export function storageKey(org, site, ref) {
  return `${STORAGE_PREFIX}:${org}:${site}:${ref}`;
}

/**
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @returns {HistoryMap}
 */
export function loadHistory(org, site, ref) {
  try {
    const raw = localStorage.getItem(storageKey(org, site, ref));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {HistoryMap} map
 */
export function saveHistory(org, site, ref, map) {
  try {
    localStorage.setItem(storageKey(org, site, ref), JSON.stringify(map));
  } catch {
    // storage full or disabled
  }
}

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

/**
 * Merge AEM platform status with local tool history (platform wins per field).
 * @param {PageHistoryEntry | undefined} platform
 * @param {PageHistoryEntry | undefined} local
 * @returns {PageHistoryEntry}
 */
export function mergeStatusEntries(platform, local) {
  /** @type {PageHistoryEntry} */
  const entry = {};
  const previewedAt = platform?.previewedAt ?? local?.previewedAt;
  const publishedAt = platform?.publishedAt ?? local?.publishedAt;
  if (previewedAt) entry.previewedAt = previewedAt;
  if (publishedAt) entry.publishedAt = publishedAt;
  return entry;
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

/**
 * @param {{ helixPath: string }[]} pages
 * @param {HistoryMap} history
 * @param {string} filterId
 * @returns {{ helixPath: string }[]}
 */
export function filterAndSortPages(pages, history, filterId) {
  if (filterId === 'all') return [...pages];

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
      return [...pages];
  }

  return filtered.map((m) => m.page);
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
  if (status === 'published') return 'On live';
  if (status === 'previewed') return 'On preview';
  return 'Not deployed';
}
