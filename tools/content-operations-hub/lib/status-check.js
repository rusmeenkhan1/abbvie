import {
  fetchPlatformStatusForPaths,
  messageFromApiError,
  isStatusPermissionError,
  STATUS_ACCESS_DENIED_MESSAGE,
} from './api.js';
import {
  commitPlatformStatus,
  getLatestCachedStatusCheckedAt,
  getUncachedHelixPaths,
  hasCompleteCachedStatus,
  hydratePlatformStatusFromCache,
  persistCurrentPlatformStatus,
} from './status-cache.js';
import {
  cancelStatusCheck,
  isFirstSessionStatusPending,
  markInitialStatusFetchComplete,
} from './state.js';
import { appHooks } from './app-hooks.js';
import { patchOrRender } from './ui-patch.js';

/**
 * @param {string} message
 */
export function formatStatusAccessMessage(message) {
  return isStatusPermissionError(message)
    ? STATUS_ACCESS_DENIED_MESSAGE
    : message;
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
function finishStatusFetch(state) {
  const { root } = state;
  const needsFullRender = root instanceof HTMLElement && (
    !root.querySelector('.bulk-pp-workspace')
    || (
      state.pages.length > 0
      && !isFirstSessionStatusPending(state)
      && !root.querySelector('#bulk-pp-page-list')
    )
  );
  patchOrRender(state, { forceRender: needsFullRender });
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {string} location
 * @param {number} docCount
 * @param {number} folderCount
 */
export function finishContentLoadWithoutStatus(
  state,
  location,
  docCount,
  folderCount,
) {
  state.firstSessionLoad = false;
  state.statusFetchBackground = false;
  state.statusChecking = false;
  state.statusFetched = false;
  markInitialStatusFetchComplete(state);
  state.statusCheckFailed = false;
  state.statusError = null;
  state.platformStatus = {};
  if (folderCount === 0 && docCount === 0) {
    state.status = `No folders or pages in ${location}.`;
  } else if (state.pageScope === 'tree') {
    state.status = `Loaded ${docCount} page(s) under ${location} (all subdirectories).`;
  } else {
    state.status = `Loaded ${docCount} page(s) and ${folderCount} folder(s) in ${location}.`;
  }
  state.statusType = 'info';
  patchOrRender(state);
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {Function | null} daFetch
 * @param {string[]} pathsToCheck
 * @param {string} location
 * @param {number} docCount
 * @param {number} folderCount
 * @param {{ background?: boolean, cacheOnly?: boolean, forceRefresh?: boolean }} [options]
 */
export function startStatusCheck(
  state,
  daFetch,
  pathsToCheck,
  location,
  docCount,
  folderCount,
  options = {},
) {
  const {
    cacheOnly = false,
    forceRefresh = false,
  } = options;
  let pathsToFetch = pathsToCheck;
  if (!forceRefresh) {
    pathsToFetch = getUncachedHelixPaths(
      state.org,
      state.site,
      state.ref,
      pathsToCheck,
    );
  }
  const cachedCount = pathsToCheck.length - pathsToFetch.length;

  cancelStatusCheck(state, false);
  state.statusCancelled = false;
  state.statusCheckFailed = false;
  state.statusError = null;
  state.statusPanelNote = null;
  state.statusFetchBackground = false;
  state.statusChecking = !cacheOnly && pathsToFetch.length > 0;
  state.statusProgressDone = cachedCount;
  state.statusProgressTotal = pathsToCheck.length;
  state.statusFetchedAt = null;
  state.statusFetchedFromCache = false;
  state.statusFetchStartedAt = !cacheOnly && pathsToFetch.length > 0
    ? Date.now()
    : null;
  state.statusAbort = !cacheOnly ? new AbortController() : null;

  if (pathsToCheck.length === 0) {
    state.statusChecking = false;
    state.statusFetchBackground = false;
    state.statusFetched = false;
    markInitialStatusFetchComplete(state);
    state.status = folderCount === 0 && docCount === 0
      ? `No folders or pages in ${location}.`
      : `Loaded ${docCount} page(s) in ${location}.`;
    state.statusType = 'info';
    patchOrRender(state);
    return;
  }

  const { hydrated, complete } = hydratePlatformStatusFromCache(
    state,
    pathsToCheck,
  );
  const cachedCheckedAt = getLatestCachedStatusCheckedAt(
    state.org,
    state.site,
    state.ref,
    pathsToCheck,
  );

  if (cacheOnly) {
    state.statusChecking = false;
    state.statusFetchBackground = false;
    state.statusAbort = null;
    state.statusFetchStartedAt = null;
    state.statusProgressDone = Object.keys(state.platformStatus || {}).length;
    state.statusProgressTotal = pathsToCheck.length;
    state.statusFetched = complete;
    state.statusFetchedAt = cachedCheckedAt;
    state.statusFetchedFromCache = Boolean(cachedCheckedAt);
    state.statusType = 'info';
    if (!hydrated) {
      state.statusPanelNote = 'No cached deployment status for this folder yet.';
      state.statusFetchedAt = null;
      state.statusFetchedFromCache = false;
    }
    state.status = null;
    markInitialStatusFetchComplete(state);
    finishStatusFetch(state);
    return;
  }

  if (pathsToFetch.length === 0) {
    state.statusChecking = false;
    state.statusFetchBackground = false;
    state.statusFetched = true;
    markInitialStatusFetchComplete(state);
    state.statusAbort = null;
    state.statusFetchStartedAt = null;
    state.statusProgressDone = pathsToCheck.length;
    state.statusProgressTotal = pathsToCheck.length;
    state.status = null;
    state.statusFetchedAt = cachedCheckedAt;
    state.statusFetchedFromCache = Boolean(cachedCheckedAt);
    state.statusType = 'info';
    finishStatusFetch(state);
    return;
  }

  state.statusProgressDone = cachedCount;
  state.statusProgressTotal = pathsToCheck.length;

  appHooks.refreshDeploymentUi?.(state);

  fetchPlatformStatusForPaths(
    daFetch,
    state.org,
    state.site,
    state.ref,
    pathsToFetch,
    (partial, done) => {
      state.platformStatus = { ...state.platformStatus, ...partial };
      state.statusProgressDone = cachedCount + done;
      state.statusProgressTotal = pathsToCheck.length;
      appHooks.refreshDeploymentUi?.(state);
    },
    { signal: state.statusAbort?.signal, folderPath: state.folderPath },
  )
    .then((platformStatus) => {
      if (state.statusAbort?.signal.aborted) return;
      if (forceRefresh) {
        commitPlatformStatus(state, platformStatus, { replacePaths: pathsToCheck });
      } else {
        commitPlatformStatus(state, {
          ...state.platformStatus,
          ...platformStatus,
        });
      }
      state.statusChecking = false;
      state.statusFetchBackground = false;
      state.statusFetched = true;
      markInitialStatusFetchComplete(state);
      state.statusAbort = null;
      state.statusFetchStartedAt = null;
      state.statusProgressDone = pathsToCheck.length;
      state.statusProgressTotal = pathsToCheck.length;
      state.statusFetchedAt = Date.now();
      state.statusFetchedFromCache = false;
      state.status = null;
      state.statusType = 'info';
      appHooks.refreshDeploymentUi?.(state);
      finishStatusFetch(state);
    })
    .catch((statusErr) => {
      if (
        statusErr instanceof DOMException
        && statusErr.name === 'AbortError'
      ) {
        state.statusChecking = false;
        state.statusFetchBackground = false;
        state.statusAbort = null;
        state.statusFetchStartedAt = null;
        const checked = state.statusProgressDone;
        const total = state.statusProgressTotal;
        if (checked > 0) {
          persistCurrentPlatformStatus(state);
          state.statusFetched = true;
          markInitialStatusFetchComplete(state);
          appHooks.refreshDeploymentUi?.(state);
        } else {
          markInitialStatusFetchComplete(state);
        }
        state.statusPanelNote = checked > 0
          ? `Stopped after ${checked} of ${total} pages. Partial results are shown.`
          : 'Status check cancelled.';
        patchOrRender(state);
        return;
      }
      state.statusChecking = false;
      state.statusFetchBackground = false;
      state.statusAbort = null;
      state.statusFetchStartedAt = null;
      const hadProgress = state.statusProgressDone > 0;
      if (hadProgress) {
        persistCurrentPlatformStatus(state);
        state.statusFetched = true;
        state.statusFetchedAt = Date.now();
        state.statusFetchedFromCache = false;
        markInitialStatusFetchComplete(state);
        state.statusCheckFailed = true;
        state.statusError = formatStatusAccessMessage(
          messageFromApiError(statusErr, 'Status check failed.', 'status'),
        );
        state.status = `${state.statusError} Partial results were saved.`;
        state.statusType = 'error';
      } else if (
        hasCompleteCachedStatus(state.org, state.site, state.ref, pathsToCheck)
      ) {
        hydratePlatformStatusFromCache(state, pathsToCheck);
        state.statusFetched = true;
        state.statusFetchedAt = getLatestCachedStatusCheckedAt(
          state.org,
          state.site,
          state.ref,
          pathsToCheck,
        );
        state.statusFetchedFromCache = Boolean(state.statusFetchedAt);
        markInitialStatusFetchComplete(state);
        state.statusCheckFailed = false;
        state.statusError = null;
        state.status = 'Could not refresh deployment status. Showing last saved results.';
        state.statusType = 'info';
      } else {
        state.statusFetched = false;
        markInitialStatusFetchComplete(state);
        state.statusCheckFailed = true;
        state.statusError = formatStatusAccessMessage(
          messageFromApiError(statusErr, 'Status check failed.', 'status'),
        );
        state.status = state.statusError;
        state.statusType = 'error';
      }
      console.warn('[bulk-pp] platform status failed', statusErr);
      patchOrRender(state);
    });
}
