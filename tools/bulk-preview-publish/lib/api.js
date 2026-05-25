import {
  DA_ADMIN,
  HLX_ADMIN,
  dedupePaths,
  classifyEntry,
  getEntryName,
  joinPath,
  normalizeFolderPath,
  toHelixPath,
} from './paths.js?v=17';

/**
 * @param {Response} resp
 * @returns {Promise<unknown>}
 */
async function parseJson(resp) {
  const text = await resp.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} data
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeListing(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = /** @type {{ items?: unknown[] }} */ (data);
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

/**
 * Normalize DA list API items (same shape as da.live nx2 hlx6ToDaList).
 * @param {string} org
 * @param {string} repo
 * @param {string} folderPath
 * @param {unknown} raw
 * @returns {Record<string, unknown>[]}
 */
function normalizeListItems(org, repo, folderPath, raw) {
  const parentPath = `/${org}/${repo}${folderPath ? `/${folderPath}` : ''}`;
  return normalizeListing(raw).map((entry) => {
    const item = /** @type {Record<string, unknown>} */ (entry);
    const rawName = String(item.name || '');
    const entryType = String(item.type || item.kind || '').toLowerCase();
    const isFolder = rawName.endsWith('/')
      || String(item['content-type'] || item.contentType || '').includes('folder')
      || entryType === 'folder' || entryType === 'directory' || entryType === 'dir'
      || item.isdir === true || item.isDirectory === true;
    let name = rawName.replace(/\/$/, '');
    let ext = String(item.ext || '').toLowerCase();

    if (!ext && name.includes('.')) {
      const parts = name.split('.');
      if (parts.length > 1) {
        ext = parts.pop().toLowerCase();
        name = parts.join('.');
      }
    }

    const contentType = item.contentType || item['content-type'] || '';
    const path = item.path || (isFolder ? `${parentPath}/${name}/` : `${parentPath}/${name}`);

    return {
      ...item,
      name: isFolder ? `${name}/` : name,
      path,
      ext,
      contentType,
      'content-type': contentType,
      isFolder,
    };
  });
}

/**
 * Fetch paginated JSON from a DA admin URL.
 * @param {Function} daFetch
 * @param {string} url
 * @returns {Promise<unknown[]>}
 */
async function fetchPaginated(daFetch, url) {
  /** @type {unknown[]} */
  const all = [];
  let continuationToken = null;

  /* eslint-disable no-await-in-loop -- paginated listing */
  do {
    const opts = continuationToken
      ? { method: 'GET', headers: { 'da-continuation-token': continuationToken } }
      : { method: 'GET' };
    const resp = await daFetch(url, opts);

    if (resp.status === 404) return all;
    if (!resp.ok) {
      const err = new Error(`Could not list folder (${resp.status})`);
      err.status = resp.status;
      throw err;
    }

    const data = await parseJson(resp);
    all.push(...normalizeListing(data));
    continuationToken = resp.headers.get('da-continuation-token')
      || resp.headers.get('x-da-continuation-token');
  } while (continuationToken);
  /* eslint-enable no-await-in-loop */

  return all;
}

/**
 * List folder contents. DA Browse uses /list/; /source/ is for file bodies.
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} repo
 * @param {string} folderPath
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listFolder(daFetch, org, repo, folderPath) {
  const normalized = normalizeFolderPath(folderPath);
  const listPath = normalized ? `/${normalized}` : '';
  const listUrl = `${DA_ADMIN}/list/${org}/${repo}${listPath}`;

  const raw = await fetchPaginated(daFetch, listUrl);
  if (raw.length > 0) {
    return normalizeListItems(org, repo, normalized, raw);
  }

  // HLX6 sites may use source directory listing; skip for invalid/app paths
  const suffix = normalized ? `${normalized}/` : '';
  if (!suffix || suffix.includes('tools/')) {
    return [];
  }

  const sourceUrl = `${DA_ADMIN}/source/${org}/${repo}/${suffix}`;
  const sourceRaw = await fetchPaginated(daFetch, sourceUrl);
  return normalizeListItems(org, repo, normalized, sourceRaw);
}

/**
 * @typedef {{ helixPath: string, sourcePath: string, name: string }} PageEntry
 */

/**
 * @typedef {{ kind: 'folder', name: string, folderPath: string }} FolderEntry
 * @typedef {{ kind: 'document' } & PageEntry} DocumentEntry
 * @typedef {{ kind: 'data', name: string, sourcePath: string }} DataEntry
 * @typedef {FolderEntry | DocumentEntry | DataEntry} BrowseEntry
 */

/**
 * List immediate children of a folder (folders and page documents).
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} repo
 * @param {string} folderPath
 * @returns {Promise<BrowseEntry[]>}
 */
export async function listFolderEntries(daFetch, org, repo, folderPath) {
  const normalized = normalizeFolderPath(folderPath);
  const entries = await listFolder(daFetch, org, repo, normalized);
  /** @type {BrowseEntry[]} */
  const result = [];

  const kindOrder = { folder: 0, document: 1, data: 2 };

  entries.forEach((entry) => {
    const name = getEntryName(entry);
    if (!name) return;

    const kind = classifyEntry(entry);
    if (kind === 'folder') {
      result.push({
        kind: 'folder',
        name,
        folderPath: joinPath(normalized, name),
      });
      return;
    }

    if (kind === 'document') {
      result.push({
        kind: 'document',
        name,
        sourcePath: joinPath(normalized, name),
        helixPath: toHelixPath(normalized, name),
      });
      return;
    }

    if (kind === 'data') {
      result.push({
        kind: 'data',
        name,
        sourcePath: joinPath(normalized, name),
      });
    }
  });

  return result.sort((a, b) => {
    const orderDiff = kindOrder[a.kind] - kindOrder[b.kind];
    if (orderDiff !== 0) return orderDiff;
    const aKey = a.kind === 'document' ? a.helixPath : a.name;
    const bKey = b.kind === 'document' ? b.helixPath : b.name;
    return aKey.localeCompare(bKey);
  });
}

/**
 * Collect HTML pages under a folder up to maxDepth.
 * maxDepth 0 = this folder only; -1 = unlimited.
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} repo
 * @param {string} rootPath
 * @param {number} maxDepth
 * @returns {Promise<PageEntry[]>}
 */
export async function collectPages(daFetch, org, repo, rootPath, maxDepth) {
  const unlimited = maxDepth < 0;
  /** @type {PageEntry[]} */
  const pages = [];

  /**
   * @param {string} folder
   * @param {number} depth
   */
  async function walk(folder, depth) {
    const entries = await listFolder(daFetch, org, repo, folder);
    const subfolders = [];

    entries.forEach((entry) => {
      const name = getEntryName(entry);
      if (classifyEntry(entry) === 'folder') {
        const folderName = String(entry.name || name).replace(/\/$/, '');
        if (folderName) subfolders.push(joinPath(folder, folderName));
        return;
      }
      if (classifyEntry(entry) === 'document') {
        pages.push({
          name,
          sourcePath: joinPath(folder, name),
          helixPath: toHelixPath(folder, name),
        });
      }
    });

    if (!unlimited && depth >= maxDepth) return;

    await Promise.all(subfolders.map((sub) => walk(sub, depth + 1)));
  }

  await walk(normalizeFolderPath(rootPath), 0);
  const byPath = new Map();
  pages.forEach((p) => byPath.set(p.helixPath, p));
  return [...byPath.values()].sort((a, b) => a.helixPath.localeCompare(b.helixPath));
}

/**
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {'preview'|'live'} topic
 * @param {string[]} paths
 * @param {{ forceUpdate?: boolean }} options
 * @returns {Promise<Record<string, unknown>>}
 */
export async function startBulkJob(daFetch, org, site, ref, topic, paths, options = {}) {
  const unique = dedupePaths(paths);
  if (unique.length === 0) {
    throw new Error('No pages selected.');
  }

  const route = topic === 'live' ? 'live' : 'preview';
  const url = `${HLX_ADMIN}/${route}/${org}/${site}/${ref}/*`;
  const body = {
    paths: unique,
    forceUpdate: Boolean(options.forceUpdate),
    forceAsync: unique.length > 5,
  };

  const resp = await daFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await parseJson(resp);
  if (!resp.ok && resp.status !== 202) {
    const message = data?.message || data?.error || `Bulk ${topic} failed (${resp.status})`;
    const err = new Error(message);
    err.status = resp.status;
    err.data = data;
    throw err;
  }

  return data || { status: resp.status };
}

/**
 * Poll job until terminal state.
 * @param {Function} daFetch
 * @param {string} jobUrl
 * @param {(job: Record<string, unknown>) => void} [onProgress]
 * @returns {Promise<Record<string, unknown>>}
 */
async function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export async function pollJob(daFetch, jobUrl, onProgress) {
  const terminal = new Set(['stopped', 'succeeded', 'failed', 'cancelled']);
  let last = null;
  let i = 0;

  /* eslint-disable no-await-in-loop -- job polling is intentionally sequential */
  while (i < 120) {
    i += 1;
    const resp = await daFetch(jobUrl, { method: 'GET' });
    const data = await parseJson(resp);
    if (data) {
      last = data;
      if (onProgress) onProgress(data);
      const state = data.state || data.job?.state;
      if (state && terminal.has(String(state))) return data;
    }
    await sleep(2000);
  }
  /* eslint-enable no-await-in-loop */

  return last || { state: 'timeout' };
}

/**
 * Map Helix job result to UI status (stopped with 0 failed = success).
 * @param {Record<string, unknown>} job
 * @returns {{ statusType: 'success'|'error'|'info', message: string }}
 */
export function resolveJobOutcome(job) {
  const state = String(job?.state || 'unknown');
  const progress = job?.progress || job?.job?.progress || {};

  const failed = Number(progress.failed ?? 0);
  const success = Number(progress.success ?? 0);
  const processed = Number(progress.processed ?? 0);
  const total = Number(progress.total ?? 0);
  const completed = success || processed || total;

  if (state === 'failed' || failed > 0) {
    return {
      statusType: 'error',
      message: `finished with ${failed} failed`,
    };
  }

  if (state === 'succeeded' || (failed === 0 && completed > 0)) {
    const count = success || processed || total;
    return {
      statusType: 'success',
      message: `completed successfully${count ? ` (${count} page${count === 1 ? '' : 's'})` : ''}`,
    };
  }

  if (state === 'cancelled') {
    return { statusType: 'info', message: 'was cancelled' };
  }

  if (state === 'timeout') {
    return { statusType: 'info', message: 'timed out — check job status in DA' };
  }

  return { statusType: 'info', message: `finished (${state})` };
}

/**
 * Resolve job self link from bulk response.
 * @param {Record<string, unknown>} bulkResponse
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {'preview'|'live'} topic
 * @returns {string|null}
 */
export function getJobPollUrl(bulkResponse, org, site, ref, topic) {
  const { links, job } = bulkResponse || {};
  if (links && typeof links === 'object') {
    const { self } = /** @type {{ self?: string }} */ (links);
    if (self) return self;
  }

  if (job && typeof job === 'object') {
    const { name, topic: jobTopic } = /** @type {{ name?: string, topic?: string }} */ (job);
    const resolvedTopic = jobTopic || topic;
    if (name && resolvedTopic) {
      return `${HLX_ADMIN}/job/${org}/${site}/${ref}/${resolvedTopic}/${name}`;
    }
  }

  return null;
}

/**
 * @param {string} helixPath
 * @returns {string}
 */
export function helixPathToApiPath(helixPath) {
  if (!helixPath || helixPath === '/') return 'index';
  return helixPath.replace(/^\/+/, '');
}

/**
 * @param {unknown} data
 * @returns {{ previewedAt?: number, publishedAt?: number }}
 */
export function parseStatusPayload(data) {
  if (!data || typeof data !== 'object') return {};
  const { preview, live } = /** @type {{
    preview?: { status?: number, lastModified?: string },
    live?: { status?: number, lastModified?: string },
  }} */ (data);
  /** @type {{ previewedAt?: number, publishedAt?: number }} */
  const entry = {};
  if (preview && Number(preview.status) === 200 && preview.lastModified) {
    const ts = Date.parse(String(preview.lastModified));
    if (!Number.isNaN(ts)) entry.previewedAt = ts;
  }
  if (live && Number(live.status) === 200 && live.lastModified) {
    const ts = Date.parse(String(live.lastModified));
    if (!Number.isNaN(ts)) entry.publishedAt = ts;
  }
  return entry;
}

/**
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string} helixPath
 */
async function fetchSinglePagePlatformStatus(daFetch, org, site, ref, helixPath) {
  const apiPath = helixPathToApiPath(helixPath);
  const url = `${HLX_ADMIN}/status/${org}/${site}/${ref}/${apiPath}`;
  const resp = await daFetch(url, { method: 'GET' });
  const data = await parseJson(resp);
  if (!resp.ok && resp.status !== 404) return {};
  return parseStatusPayload(data);
}

/**
 * @param {string} path
 */
function normalizeWebPath(path) {
  if (!path) return '/';
  const p = path.startsWith('/') ? path : `/${path}`;
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p || '/';
}

/**
 * @param {unknown} jobData
 * @returns {Array<Record<string, unknown>>}
 */
function extractStatusResources(jobData) {
  if (!jobData || typeof jobData !== 'object') return [];
  const root = /** @type {Record<string, unknown>} */ (jobData);
  const data = root.data && typeof root.data === 'object'
    ? /** @type {Record<string, unknown>} */ (root.data)
    : root;

  if (Array.isArray(data.resources)) return data.resources;
  if (data.resources && typeof data.resources === 'object') {
    const groups = /** @type {Record<string, unknown[]>} */ (data.resources);
    const merged = [];
    ['preview', 'live', 'edit'].forEach((key) => {
      const bucket = groups[key];
      if (!Array.isArray(bucket)) return;
      bucket.forEach((item) => {
        if (typeof item === 'string') {
          merged.push({ webPath: item, _bucket: key });
        } else if (item && typeof item === 'object') {
          merged.push({ .../** @type {Record<string, unknown>} */ (item), _bucket: key });
        }
      });
    });
    return merged;
  }
  return [];
}

/**
 * @param {unknown} jobData
 * @param {string[]} helixPaths
 * @returns {Record<string, { previewedAt?: number, publishedAt?: number }>}
 */
function mapStatusJobToEntries(jobData, helixPaths) {
  /** @type {Record<string, { previewedAt?: number, publishedAt?: number }>} */
  const result = {};
  helixPaths.forEach((p) => { result[p] = {}; });

  const byWebPath = new Map();
  helixPaths.forEach((p) => {
    byWebPath.set(normalizeWebPath(p), p);
    if (p === '/index' || p.endsWith('/index')) {
      byWebPath.set('/', p);
      byWebPath.set('/index', p);
    }
  });

  const touchEntry = (webPath, bucket, item) => {
    const helix = byWebPath.get(normalizeWebPath(webPath));
    if (!helix) return;
    const entry = result[helix] || {};
    const previewTs = item?.previewLastModified || item?.preview?.lastModified;
    const liveTs = item?.publishLastModified || item?.liveLastModified || item?.live?.lastModified;
    if (previewTs || bucket === 'preview') {
      const ts = previewTs ? Date.parse(String(previewTs)) : Date.now();
      if (!Number.isNaN(ts)) entry.previewedAt = ts;
    }
    if (liveTs || bucket === 'live') {
      const ts = liveTs ? Date.parse(String(liveTs)) : Date.now();
      if (!Number.isNaN(ts)) entry.publishedAt = ts;
    }
    result[helix] = entry;
  };

  extractStatusResources(jobData).forEach((item) => {
    if (typeof item === 'string') {
      touchEntry(item, 'preview', null);
      return;
    }
    const bucket = String(item._bucket || '');
    touchEntry(String(item.webPath || item.path || ''), bucket, item);
  });

  return result;
}

/**
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string[]} helixPaths
 */
async function fetchBulkPlatformStatus(daFetch, org, site, ref, helixPaths) {
  const url = `${HLX_ADMIN}/status/${org}/${site}/${ref}/*`;
  const resp = await daFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paths: helixPaths.map(helixPathToApiPath),
      select: ['preview', 'live'],
      forceAsync: helixPaths.length > 5,
    }),
  });
  const data = await parseJson(resp);
  if (!resp.ok && resp.status !== 202) {
    throw new Error(data?.message || data?.error || `Status check failed (${resp.status})`);
  }

  const jobUrl = getJobPollUrl(data || {}, org, site, ref, 'status');
  if (!jobUrl) return {};

  const finalJob = await pollJob(daFetch, jobUrl);
  let details = finalJob;
  try {
    const detailsResp = await daFetch(`${jobUrl}/details`, { method: 'GET' });
    const detailsJson = await parseJson(detailsResp);
    if (detailsResp.ok && detailsJson) details = detailsJson;
  } catch {
    // use polled job payload
  }
  return mapStatusJobToEntries(details, helixPaths);
}

/**
 * Load preview/live timestamps from AEM Admin API (real deployment state).
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string[]} helixPaths
 * @returns {Promise<Record<string, { previewedAt?: number, publishedAt?: number }>>}
 */
export async function fetchPlatformStatusForPaths(daFetch, org, site, ref, helixPaths) {
  const unique = dedupePaths(helixPaths);
  if (unique.length === 0) return {};

  if (unique.length > 40) {
    return fetchBulkPlatformStatus(daFetch, org, site, ref, unique);
  }

  /** @type {Record<string, { previewedAt?: number, publishedAt?: number }>} */
  const result = {};
  let index = 0;
  const workers = 8;
  await Promise.all(Array.from({ length: Math.min(workers, unique.length) }, async () => {
    while (index < unique.length) {
      const path = unique[index];
      index += 1;
      try {
        result[path] = await fetchSinglePagePlatformStatus(daFetch, org, site, ref, path);
      } catch {
        result[path] = {};
      }
    }
  }));
  return result;
}
