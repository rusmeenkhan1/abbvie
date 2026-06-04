import {
  filterAndSortPages,
  filterPagesBySearch,
} from './page-history.js?t=mpyxlouk';
import {
  isSiteShellPage,
  resolveContentFolderPath,
} from './paths.js?t=mpyxlouk';

/** @typedef {{ kind: 'folder', name: string, folderPath: string }} FolderEntry */
/** @typedef {{ kind: 'document', helixPath: string, sourcePath: string, name: string }} DocumentEntry */

export const SEARCH_MIN_LEN = 3;

/**
 * @typedef {{
 *   topic: 'preview' | 'live',
 *   paths: string[],
 *   urls: string[],
 *   host: string,
 *   title: string,
 *   completedAt: number,
 * }} LastOperation
 */

/**
 * @param {{ org: string, site: string, ref: string }} ctx
 */
export function createAppState(ctx) {
  return {
    root: null,
    org: ctx.org,
    site: ctx.site,
    ref: ctx.ref,
    folderPath: '',
    pageScope: 'folder',
    loading: false,
    contentLoading: false,
    error: null,
    status: null,
    statusType: 'info',
    jobDetail: null,
    activeTab: 'pages',
    pageFilter: 'all',
    pageSearch: '',
    folderSearch: '',
    platformStatus: {},
    statusCheckFailed: false,
    statusError: null,
    statusChecking: false,
    statusCancelled: false,
    statusProgressDone: 0,
    statusProgressTotal: 0,
    /** @type {LastOperation | null} */
    lastOperation: null,
    /** @type {AbortController | null} */
    statusAbort: null,
    /** @type {FolderEntry[]} */
    folders: [],
    /** @type {DocumentEntry[]} */
    pages: [],
    /** @type {Set<string>} */
    selected: new Set(),
  };
}

/**
 * Full reset on browser reload — empty workspace.
 * @param {ReturnType<typeof createAppState>} state
 */
export function resetWorkspace(state) {
  state.folderPath = '';
  state.pageScope = 'folder';
  state.loading = false;
  state.contentLoading = false;
  state.error = null;
  state.status = null;
  state.statusType = 'info';
  state.jobDetail = null;
  state.activeTab = 'pages';
  state.pageFilter = 'all';
  state.pageSearch = '';
  state.folderSearch = '';
  state.platformStatus = {};
  state.statusCheckFailed = false;
  state.statusError = null;
  state.statusChecking = false;
  state.statusCancelled = false;
  state.statusProgressDone = 0;
  state.statusProgressTotal = 0;
  state.lastOperation = null;
  state.folders = [];
  state.pages = [];
  state.selected.clear();
  cancelStatusCheck(state, false);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {boolean} [setMessage]
 */
export function cancelStatusCheck(state, setMessage = true) {
  if (state.statusAbort) {
    state.statusAbort.abort();
    state.statusAbort = null;
  }
  if (!state.statusChecking) return;
  state.statusChecking = false;
  if (setMessage) {
    const checked = state.statusProgressDone;
    const total = state.statusProgressTotal;
    state.statusCancelled = true;
    state.status = checked > 0
      ? `Status check stopped · ${checked} of ${total} pages checked (partial results kept)`
      : 'Status check cancelled before any pages were checked';
    state.statusType = 'info';
  }
}

/** @param {ReturnType<typeof createAppState>} state */
export function pruneSiteShellFromSelection(state) {
  state.pages.forEach((p) => {
    if (isSiteShellPage(p)) state.selected.delete(p.helixPath);
  });
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
export function buildStatusMap(state) {
  const platform = state.platformStatus || {};
  /** @type {Record<string, { previewedAt?: number, publishedAt?: number }>} */
  const map = {};
  state.pages.forEach((page) => {
    map[page.helixPath] = platform[page.helixPath] || {};
  });
  return map;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
export function isStatusLoaded(state) {
  if (state.statusCheckFailed || state.statusChecking) return false;
  return state.pages.length > 0;
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
export function getVisiblePages(state) {
  const statusMap = buildStatusMap(state);
  const browseFolder = resolveContentFolderPath(state.folderPath);
  let visible = filterAndSortPages(
    state.pages,
    statusMap,
    String(state.pageFilter || 'all'),
    browseFolder,
  );
  visible = /** @type {DocumentEntry[]} */ (filterPagesBySearch(
    visible,
    String(state.pageSearch || ''),
    browseFolder,
    SEARCH_MIN_LEN,
  ));
  return { visible, statusMap, browseFolder };
}

/**
 * @param {{ name: string, folderPath: string }[]} folders
 * @param {string} query
 * @param {number} [minLen]
 */
export function filterFoldersBySearch(folders, query, minLen = SEARCH_MIN_LEN) {
  const q = String(query || '').trim().toLowerCase();
  if (!q || q.length < minLen) return folders;
  return folders.filter((f) => (
    f.name.toLowerCase().includes(q) || f.folderPath.toLowerCase().includes(q)
  ));
}

/**
 * @param {ReturnType<typeof createAppState>} state
 */
export function getVisibleFolders(state) {
  return filterFoldersBySearch(state.folders, state.folderSearch, SEARCH_MIN_LEN);
}

/**
 * @param {ReturnType<typeof createAppState>} state
 * @param {boolean} checked
 */
export function selectAllVisible(state, checked) {
  const { visible } = getVisiblePages(state);
  const selectable = visible.filter((p) => !isSiteShellPage(p));
  if (checked) {
    selectable.forEach((p) => state.selected.add(p.helixPath));
  } else {
    selectable.forEach((p) => state.selected.delete(p.helixPath));
  }
  pruneSiteShellFromSelection(state);
}
