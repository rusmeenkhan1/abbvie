const STORAGE_KEY = 'bulk-pp-view-preferences-v1';

/** @typedef {{ pageScope: 'folder'|'tree', autoLoadStatus: boolean }} ViewPreferences */

const DEFAULTS = /** @type {ViewPreferences} */ ({
  pageScope: 'folder',
  autoLoadStatus: false,
});

/**
 * @returns {ViewPreferences}
 */
export function loadViewPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS };
    return {
      pageScope: parsed.pageScope === 'tree' ? 'tree' : 'folder',
      autoLoadStatus: Boolean(parsed.autoLoadStatus),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * @param {ViewPreferences} prefs
 */
export function saveViewPreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pageScope: prefs.pageScope === 'tree' ? 'tree' : 'folder',
      autoLoadStatus: Boolean(prefs.autoLoadStatus),
    }));
  } catch (err) {
    console.warn('[bulk-pp] view preferences write failed', err);
  }
}
