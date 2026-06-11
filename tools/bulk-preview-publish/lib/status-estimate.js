import {
  STATUS_BATCH_PAUSE_MS,
  STATUS_BULK_PATH_CHUNK_SIZE,
  STATUS_MAX_CONCURRENT_REQUESTS,
  STATUS_PARALLEL_BATCH_SIZE,
} from './api.js';

const BATCH_PAUSE_SEC = STATUS_BATCH_PAUSE_MS / 1000;
const BULK_MIN_PAGES = 3;

/** Typical seconds per parallel wave of per-page GETs. */
const BATCH_SEC_OPTIMISTIC = 1.6;
const BATCH_SEC_PESSIMISTIC = 3;

/** One bulk status job (POST + poll), sequential chunks. */
const BULK_JOB_SEC_OPTIMISTIC = 3.5;
const BULK_JOB_SEC_PESSIMISTIC = 8;

/**
 * Share of pages that still need per-page checks after bulk (varies by site).
 * @param {number} pageCount
 * @param {'optimistic' | 'pessimistic'} mode
 */
function remainingAfterBulkRatio(pageCount, mode) {
  if (mode === 'optimistic') {
    if (pageCount <= 20) return 0.06;
    if (pageCount <= 80) return 0.12;
    return 0.18;
  }
  if (pageCount <= 20) return 0.25;
  if (pageCount <= 80) return 0.38;
  return 0.5;
}

/**
 * @param {number} pageCount
 * @param {'optimistic' | 'pessimistic'} mode
 */
function estimateParallelSeconds(pageCount, mode) {
  if (pageCount <= 0) return 0;
  const perBatch = mode === 'optimistic' ? BATCH_SEC_OPTIMISTIC : BATCH_SEC_PESSIMISTIC;
  const batchSize = STATUS_PARALLEL_BATCH_SIZE || STATUS_MAX_CONCURRENT_REQUESTS;
  const batches = Math.ceil(pageCount / batchSize);
  const batched = batches * perBatch + Math.max(0, batches - 1) * BATCH_PAUSE_SEC;
  const perPageFloor = mode === 'optimistic' ? 0.12 : 0.35;
  return Math.max(batched, pageCount * perPageFloor);
}

/**
 * @param {number} pageCount
 * @param {'optimistic' | 'pessimistic'} mode
 */
function estimateBulkSeconds(pageCount, mode) {
  if (pageCount < BULK_MIN_PAGES) return 0;
  const perJob = mode === 'optimistic' ? BULK_JOB_SEC_OPTIMISTIC : BULK_JOB_SEC_PESSIMISTIC;
  const chunks = Math.ceil(pageCount / STATUS_BULK_PATH_CHUNK_SIZE);
  return chunks * perJob;
}

/**
 * @param {number} pageCount
 * @param {'optimistic' | 'pessimistic'} mode
 */
export function estimateStatusFetchSeconds(pageCount, mode = 'optimistic') {
  const n = Math.max(0, Math.floor(pageCount));
  if (n === 0) return 0;
  if (n < BULK_MIN_PAGES) return estimateParallelSeconds(n, mode);
  const bulk = estimateBulkSeconds(n, mode);
  const remaining = Math.max(0, Math.ceil(n * remainingAfterBulkRatio(n, mode)));
  return bulk + estimateParallelSeconds(remaining, mode);
}

/**
 * @param {number} seconds
 */
export function formatDurationSeconds(seconds) {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const mins = Math.round(s / 60);
  if (mins < 60) return mins === 1 ? '1 min' : `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return hours === 1 ? '1 hr' : `${hours} hr`;
  return `${hours} hr ${rem} min`;
}

/**
 * @param {number} pageCount
 */
export function formatStatusFetchEta(pageCount) {
  const n = Math.max(0, Math.floor(pageCount));
  if (n === 0) return null;
  const minSec = estimateStatusFetchSeconds(n, 'optimistic');
  const maxSec = estimateStatusFetchSeconds(n, 'pessimistic');
  if (maxSec - minSec < 20) {
    return `~${formatDurationSeconds((minSec + maxSec) / 2)}`;
  }
  return `~${formatDurationSeconds(minSec)}–${formatDurationSeconds(maxSec)}`;
}

/**
 * @param {number} startedAt
 * @param {number} done
 * @param {number} total
 */
export function formatRuntimeStatusEta(startedAt, done, total) {
  if (!startedAt || total <= 0 || done <= 0 || done >= total) {
    if (done >= total && total > 0) return 'Finishing up…';
    return null;
  }
  const elapsed = (Date.now() - startedAt) / 1000;
  if (elapsed < 2 || done < 3) return null;
  const remainingSec = ((total - done) * elapsed) / done;
  if (remainingSec < 8) return 'Less than 10 sec remaining';
  return `About ${formatDurationSeconds(remainingSec)} remaining`;
}
