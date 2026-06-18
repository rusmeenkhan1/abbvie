import {
  deleteDaDocumentsSequential,
  fetchPlatformStatusForPaths,
  getJobPollUrl,
  messageFromApiError,
  permissionErrorHint,
  pollJob,
  resolveJobOutcome,
  runBulkRemoveJob,
  startBulkJob,
} from './api.js';
import {
  buildOptimisticStatusPatch,
  commitPlatformStatus,
  removePathsFromStatusCache,
} from './status-cache.js';
import { confirmBulkRun, confirmDestructiveAction } from './modal.js';
import { buildSiteHost, buildUrlsForPaths } from './urls.js';
import {
  closeJobModal,
  openJobModal,
  showJobCompleteModal,
  showJobErrorModal,
  updateJobModal,
} from './progress-modal.js';
import { getSelectedHelixPaths } from './state.js';
import { appHooks } from './app-hooks.js';
import { patchWorkspaceUi } from './ui-patch.js';

/** @typedef {'preview'|'live'|'unpreview'|'unpublish'|'delete'} JobTopic */

/**
 * @param {JobTopic | null | undefined} topic
 */
export function jobActionLabel(topic) {
  if (topic === 'delete') return 'delete';
  if (topic === 'unpublish') return 'unpublish';
  if (topic === 'unpreview') return 'unpreview';
  if (topic === 'live') return 'publish';
  return 'preview';
}

/**
 * @param {'unpreview'|'unpublish'|'delete'} action
 * @param {number} count
 */
export function destructiveStartMessage(action, count) {
  const noun = count === 1 ? 'page' : 'pages';
  if (action === 'delete') return `Starting delete for ${count} ${noun}…`;
  if (action === 'unpublish') return `Starting unpublish for ${count} ${noun}…`;
  return `Starting unpreview for ${count} ${noun}…`;
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
function finishProgressModal(state) {
  const { root } = state;
  closeJobModal(/** @type {HTMLElement | null} */ (root));
  state.jobTopic = null;
  state.jobAbort = null;
  state.jobStartedAt = null;
  if (state.statusType === 'success') {
    state.status = null;
  }
  if (root instanceof HTMLElement) patchWorkspaceUi(state);
}

/**
 * @param {unknown} err
 * @param {string} message
 */
function errorHintFrom(err, message) {
  const status = err && typeof err === 'object' && 'status' in err
    ? Number(/** @type {{ status?: number }} */ (err).status)
    : 0;
  return permissionErrorHint(status, message);
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {JobTopic} topic
 * @param {unknown} err
 * @param {import('./api.js').AdminOperation | ''} [operation]
 */
function presentJobError(state, topic, err, operation = '') {
  const msg = messageFromApiError(err, 'Operation failed.', operation);
  state.status = msg;
  state.statusType = 'error';
  if (err && typeof err === 'object' && 'data' in err && err.data) {
    state.jobDetail = JSON.stringify(err.data, null, 2);
  }
  showJobErrorModal({
    message: msg,
    topic,
    hint: errorHintFrom(err, msg),
    onClose: () => finishProgressModal(state),
  });
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {string[]} helixPaths
 */
function removePagesFromState(state, helixPaths) {
  const remove = new Set(helixPaths);
  state.pages = state.pages.filter((p) => !remove.has(p.helixPath));
  helixPaths.forEach((path) => state.selected.delete(path));
  const nextStatus = { ...state.platformStatus };
  helixPaths.forEach((path) => {
    delete nextStatus[path];
  });
  state.platformStatus = nextStatus;
  removePathsFromStatusCache(state.org, state.site, state.ref, helixPaths);
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {Function | null} daFetch
 * @param {string[]} paths
 * @param {JobTopic} topic
 */
async function refreshPlatformStatusAfterJob(state, daFetch, paths, topic) {
  if (!daFetch || paths.length === 0) return;
  if (topic === 'delete') {
    removePathsFromStatusCache(state.org, state.site, state.ref, paths);
    const next = { ...state.platformStatus };
    paths.forEach((path) => {
      delete next[path];
    });
    state.platformStatus = next;
    appHooks.refreshDeploymentUi?.(state);
    return;
  }

  const isRemoval = topic === 'unpreview' || topic === 'unpublish';
  const optimistic = buildOptimisticStatusPatch(
    topic,
    paths,
    state.platformStatus,
  );
  if (Object.keys(optimistic).length > 0 || isRemoval) {
    commitPlatformStatus(
      state,
      optimistic,
      isRemoval ? { replacePaths: paths } : undefined,
    );
    appHooks.refreshDeploymentUi?.(state);
  }

  try {
    const refreshed = await fetchPlatformStatusForPaths(
      daFetch,
      state.org,
      state.site,
      state.ref,
      paths,
      undefined,
      { folderPath: state.folderPath },
    );
    commitPlatformStatus(
      state,
      refreshed,
      isRemoval ? { replacePaths: paths, removalTopic: topic } : undefined,
    );
  } catch (refreshErr) {
    console.warn('[bulk-pp] status refresh after job failed', refreshErr);
  }
  appHooks.refreshDeploymentUi?.(state);
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {string[]} paths
 * @param {string} [phaseLabel]
 * @param {Record<string, unknown>} job
 */
function applyJobProgress(state, paths, phaseLabel, job) {
  const progress = job.progress || job.job?.progress;
  if (progress && typeof progress === 'object') {
    /** @type {{ total?: number, processed?: number, failed?: number }} */
    const typedProgress = progress;
    const { total, processed, failed } = typedProgress;
    const proc = Number(processed ?? 0);
    const tot = Number(total ?? paths.length);
    state.jobProgressProcessed = proc;
    state.jobProgressTotal = tot || paths.length;
    updateJobModal({
      jobStartedAt: state.jobStartedAt,
      processed: proc,
      total: tot || paths.length,
      failed: Number(failed ?? 0),
      stateLabel: String(job.state || job.job?.state || 'running'),
      phaseLabel,
    });
  }
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {string[]} paths
 * @param {string} phaseLabel
 * @param {number} processed
 * @param {number} failed
 * @param {number} [total]
 */
function setSequentialProgress(
  state,
  paths,
  phaseLabel,
  processed,
  failed,
  total = paths.length,
) {
  state.jobProgressProcessed = processed;
  state.jobProgressTotal = total;
  updateJobModal({
    jobStartedAt: state.jobStartedAt,
    processed,
    total,
    failed,
    stateLabel: 'running',
    phaseLabel,
  });
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {Function} daFetch
 * @param {'preview'|'live'} partition
 * @param {string[]} paths
 * @param {string} phaseLabel
 */
async function runRemovePartitionJob(
  state,
  daFetch,
  partition,
  paths,
  phaseLabel,
) {
  const finalJob = await runBulkRemoveJob(
    daFetch,
    state.org,
    state.site,
    state.ref,
    partition,
    paths,
    (job) => {
      if (state.jobAbort?.signal.aborted) return;
      applyJobProgress(state, paths, phaseLabel, job);
    },
    state.jobAbort?.signal,
  );
  return resolveJobOutcome(finalJob);
}

/**
 * @param {string[]} paths
 * @param {Record<string, { previewedAt?: number, publishedAt?: number }>} platformStatus
 */
function pathsNeedingPreviewBeforePublish(paths, platformStatus) {
  return paths.filter((path) => {
    const entry = platformStatus[path];
    return !entry?.previewedAt;
  });
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {Function} daFetch
 * @param {'preview'|'live'} topic
 * @param {string[]} paths
 * @param {string} [phaseLabel]
 */
async function runBulkDeployJob(state, daFetch, topic, paths, phaseLabel = '') {
  const bulkResp = await startBulkJob(
    daFetch,
    state.org,
    state.site,
    state.ref,
    topic,
    paths,
  );
  if (state.jobAbort?.signal.aborted) {
    return { statusType: /** @type {const} */ ('info'), message: 'cancelled', finalJob: null };
  }

  const jobUrl = getJobPollUrl(
    bulkResp,
    state.org,
    state.site,
    state.ref,
    topic,
  );
  if (!jobUrl) {
    return {
      statusType: /** @type {const} */ ('success'),
      message: `scheduled (${paths.length} page${paths.length === 1 ? '' : 's'})`,
      finalJob: bulkResp,
    };
  }

  const finalJob = await pollJob(
    daFetch,
    jobUrl,
    (job) => {
      if (state.jobAbort?.signal.aborted) return;
      applyJobProgress(state, paths, phaseLabel, job);
    },
    state.jobAbort?.signal,
  );
  if (state.jobAbort?.signal.aborted) {
    return { statusType: /** @type {const} */ ('info'), message: 'cancelled', finalJob: null };
  }
  return { ...resolveJobOutcome(finalJob), finalJob };
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {HTMLElement} appRoot
 * @param {Function | null} daFetch
 */
export function bindJobRunHandlers(state, appRoot, daFetch) {
  state.onRun = async (topic) => {
    const pagePaths = new Set(state.pages.map((p) => p.helixPath));
    const paths = [...state.selected].filter((path) => pagePaths.has(path));
    if (paths.length === 0) return;

    const confirmed = await confirmBulkRun(topic, paths.length);
    if (!confirmed) return;

    appHooks.applyOperationWorkspaceReset?.(state);

    state.loading = true;
    state.jobTopic = topic;
    state.jobDetail = null;
    state.jobAbort = new AbortController();
    state.jobStartedAt = Date.now();
    state.jobProgressProcessed = 0;
    state.jobProgressTotal = paths.length;
    state.status = topic === 'live'
      ? `Starting bulk publish for ${paths.length} page(s)…`
      : `Starting bulk preview for ${paths.length} page(s)…`;
    state.statusType = 'info';
    openJobModal(appRoot, topic, paths.length, () => state.onCancelJob());

    const host = buildSiteHost(state.org, state.site, state.ref);
    const env = topic === 'live' ? 'live' : 'preview';
    const action = topic === 'live' ? 'Bulk publish' : 'Bulk preview';

    try {
      /** @type {string[]} */
      let previewFirst = [];
      if (topic === 'live') {
        previewFirst = pathsNeedingPreviewBeforePublish(paths, state.platformStatus);
        if (previewFirst.length > 0) {
          const previewPhase = previewFirst.length === paths.length
            ? 'Step 1 of 2 · Preview before publish'
            : `Step 1 of 2 · Preview ${previewFirst.length} page${previewFirst.length === 1 ? '' : 's'} before publish`;
          state.jobProgressProcessed = 0;
          state.jobProgressTotal = previewFirst.length;
          updateJobModal({
            jobStartedAt: state.jobStartedAt,
            processed: 0,
            total: previewFirst.length,
            failed: 0,
            stateLabel: 'running',
            phaseLabel: previewPhase,
          });
          const previewOutcome = await runBulkDeployJob(
            state,
            daFetch,
            'preview',
            previewFirst,
            previewPhase,
          );
          if (state.jobAbort?.signal.aborted) return;
          if (previewOutcome.statusType === 'error') {
            const previewMessage = `Preview before publish ${previewOutcome.message}`;
            state.status = previewMessage;
            state.statusType = 'error';
            showJobErrorModal({
              message: previewMessage,
              topic: 'preview',
              hint: permissionErrorHint(0, previewMessage),
              onClose: () => finishProgressModal(state),
            });
            return;
          }
          await refreshPlatformStatusAfterJob(state, daFetch, previewFirst, 'preview');
          state.jobProgressProcessed = 0;
          state.jobProgressTotal = paths.length;
          updateJobModal({
            jobStartedAt: state.jobStartedAt,
            processed: 0,
            total: paths.length,
            failed: 0,
            stateLabel: 'running',
            phaseLabel: 'Step 2 of 2 · Publish',
          });
        }
      }

      const publishPhase = previewFirst.length > 0 ? 'Step 2 of 2 · Publish' : '';
      const deployOutcome = await runBulkDeployJob(
        state,
        daFetch,
        topic,
        paths,
        publishPhase,
      );
      if (state.jobAbort?.signal.aborted) return;
      if (deployOutcome.message === 'cancelled') return;

      const { finalJob } = deployOutcome;
      const outcome = {
        statusType: deployOutcome.statusType,
        message: deployOutcome.message,
      };
      const statusMessage = `${action} ${outcome.message}`;
      state.statusType = outcome.statusType;
      state.status = outcome.statusType === 'error' ? statusMessage : null;

      let urls = [];
      if (outcome.statusType === 'success' || outcome.statusType === 'info') {
        if (outcome.statusType === 'success') {
          urls = buildUrlsForPaths(paths, state.org, state.site, state.ref, env);
        }
        await refreshPlatformStatusAfterJob(state, daFetch, paths, topic);
      }

      updateJobModal({
        jobStartedAt: state.jobStartedAt,
        processed: paths.length,
        total: paths.length,
        failed: 0,
        stateLabel: 'complete',
        phaseLabel: publishPhase,
      });

      state.jobDetail = outcome.statusType === 'error'
        || new URLSearchParams(window.location.search).has('debug')
        ? JSON.stringify(finalJob, null, 2)
        : null;

      if (outcome.statusType === 'error') {
        showJobErrorModal({
          message: statusMessage,
          topic,
          hint: permissionErrorHint(0, statusMessage),
          onClose: () => finishProgressModal(state),
        });
      } else {
        const summary = previewFirst.length > 0 && topic === 'live'
          ? `Published ${paths.length} page${paths.length === 1 ? '' : 's'} (${previewFirst.length} previewed first).`
          : statusMessage;
        showJobCompleteModal({
          summary,
          topic,
          urls,
          host,
          onClose: () => finishProgressModal(state),
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      presentJobError(state, topic, err, topic);
    } finally {
      state.loading = false;
      state.jobAbort = null;
      state.jobStartedAt = null;
    }
  };

  state.onRunDestructive = async (action) => {
    const pageByPath = new Map(state.pages.map((p) => [p.helixPath, p]));
    const paths = getSelectedHelixPaths(state);
    if (paths.length === 0) return;

    const ok = await confirmDestructiveAction(action, paths.length);
    if (!ok) return;

    appHooks.applyOperationWorkspaceReset?.(state);

    const topic = /** @type {'unpreview'|'unpublish'|'delete'} */ (action);
    state.loading = true;
    state.jobTopic = topic;
    state.jobDetail = null;
    state.jobAbort = new AbortController();
    state.jobStartedAt = Date.now();
    state.jobProgressProcessed = 0;
    state.jobProgressTotal = paths.length;
    state.statusType = 'info';
    state.status = destructiveStartMessage(action, paths.length);
    openJobModal(appRoot, topic, paths.length, () => state.onCancelJob());

    /** @type {string[]} */
    const notes = [];
    let statusType = 'success';

    try {
      if (action === 'unpreview' || action === 'delete') {
        try {
          const outcome = await runRemovePartitionJob(
            state,
            daFetch,
            'preview',
            paths,
            action === 'delete' ? 'Step 1 of 3 · Unpreview' : 'Unpreview',
          );
          notes.push(`Preview removal ${outcome.message}`);
          if (outcome.statusType === 'error') statusType = 'error';
          else if (outcome.statusType === 'info' && statusType === 'success') statusType = 'info';
        } catch (phaseErr) {
          if (
            phaseErr instanceof DOMException
            && phaseErr.name === 'AbortError'
          ) return;
          notes.push(
            `Preview removal failed: ${messageFromApiError(phaseErr, 'Preview removal failed.', 'unpreview')}`,
          );
          statusType = 'error';
          console.warn('[bulk-pp] unpreview phase failed', phaseErr);
        }
        if (
          action === 'delete'
          && statusType !== 'error'
          && !state.jobAbort?.signal.aborted
        ) {
          await refreshPlatformStatusAfterJob(
            state,
            daFetch,
            paths,
            'unpreview',
          );
        }
      }

      if (state.jobAbort?.signal.aborted) return;

      if (action === 'unpublish' || action === 'delete') {
        try {
          const outcome = await runRemovePartitionJob(
            state,
            daFetch,
            'live',
            paths,
            action === 'delete' ? 'Step 2 of 3 · Unpublish' : 'Unpublish',
          );
          notes.push(`Unpublish ${outcome.message}`);
          if (outcome.statusType === 'error') statusType = 'error';
          else if (outcome.statusType === 'info' && statusType === 'success') statusType = 'info';
        } catch (phaseErr) {
          if (
            phaseErr instanceof DOMException
            && phaseErr.name === 'AbortError'
          ) return;
          notes.push(
            `Unpublish failed: ${messageFromApiError(phaseErr, 'Unpublish failed.', 'unpublish')}`,
          );
          statusType = 'error';
          console.warn('[bulk-pp] unpublish phase failed', phaseErr);
        }
        if (
          action === 'delete'
          && statusType !== 'error'
          && !state.jobAbort?.signal.aborted
        ) {
          await refreshPlatformStatusAfterJob(
            state,
            daFetch,
            paths,
            'unpublish',
          );
        }
      }

      if (state.jobAbort?.signal.aborted) return;

      if (action === 'delete') {
        const pages = paths.map((path) => pageByPath.get(path)).filter(Boolean);
        const daResult = await deleteDaDocumentsSequential(
          daFetch,
          state.org,
          state.site,
          pages,
          ({ processed, total, failed }) => {
            if (state.jobAbort?.signal.aborted) return;
            setSequentialProgress(
              state,
              paths,
              'Step 3 of 3 · Delete from DA',
              processed,
              failed,
              total,
            );
          },
          state.jobAbort?.signal,
        );

        if (daResult.deleted.length > 0) {
          removePagesFromState(state, daResult.deleted);
          notes.push(
            `Deleted ${daResult.deleted.length} document${daResult.deleted.length === 1 ? '' : 's'} from DA`,
          );
        }
        if (daResult.failed > 0) {
          statusType = daResult.deleted.length > 0 ? 'info' : 'error';
          const sample = daResult.errors
            .slice(0, 3)
            .map((e) => `${e.helixPath}: ${e.message}`)
            .join('; ');
          notes.push(
            `${daResult.failed} delete${daResult.failed === 1 ? '' : 's'} failed${sample ? ` (${sample})` : ''}`,
          );
        }
      }

      if (state.jobAbort?.signal.aborted) return;

      if (statusType !== 'error') {
        await refreshPlatformStatusAfterJob(state, daFetch, paths, action);
      }

      const summary = notes.filter(Boolean).join('. ') || 'Operation finished.';
      state.statusType = statusType;
      state.status = statusType === 'error' ? summary : null;

      updateJobModal({
        jobStartedAt: state.jobStartedAt,
        processed: paths.length,
        total: paths.length,
        failed: 0,
        stateLabel: 'complete',
      });

      if (statusType === 'error') {
        showJobErrorModal({
          message: summary,
          topic,
          hint: permissionErrorHint(0, summary),
          onClose: () => finishProgressModal(state),
        });
      } else {
        showJobCompleteModal({
          summary,
          topic,
          onClose: () => finishProgressModal(state),
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      presentJobError(state, topic, err, action);
    } finally {
      state.loading = false;
      state.jobAbort = null;
      state.jobStartedAt = null;
    }
  };
}

export { finishProgressModal };
