import {
  DA_ADMIN,
  dedupePaths,
  classifyEntry,
  getEntryName,
  joinPath,
  normalizeFolderPath,
  rewriteAdminUrl,
  toHelixPath,
} from './paths.js?v=24';

/** Browser-safe AEM Admin base (CORS); daFetch still supplies auth. */
const ADMIN_API = DA_ADMIN;

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
  const url = `${ADMIN_API}/${route}/${org}/${site}/${ref}/*`;
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

/**
 * @param {Function} daFetch
 * @param {string} jobUrl
 */
async function fetchJobDetails(daFetch, jobUrl) {
  const base = rewriteAdminUrl(jobUrl).replace(/\/$/, '');
  const detailsResp = await daFetch(`${base}/details`, { method: 'GET' });
  const details = await parseJson(detailsResp);
  if (detailsResp.ok && details) return /** @type {Record<string, unknown>} */ (details);
  return null;
}

export async function pollJob(daFetch, jobUrl, onProgress) {
  const terminal = new Set(['stopped', 'succeeded', 'failed', 'cancelled']);
  let last = null;
  let notFoundCount = 0;
  const resolvedJobUrl = rewriteAdminUrl(jobUrl);

  /* eslint-disable no-await-in-loop -- job polling is intentionally sequential */
  for (let i = 0; i < 60; i += 1) {
    const resp = await daFetch(resolvedJobUrl, { method: 'GET' });

    if (resp.status === 404 || resp.status === 410) {
      notFoundCount += 1;
      const details = await fetchJobDetails(daFetch, resolvedJobUrl);
      if (details) return details;
      if (notFoundCount >= 2) return last || { state: 'stopped' };
      await sleep(1000);
      continue;
    }

    notFoundCount = 0;
    const data = await parseJson(resp);
    if (data) {
      last = /** @type {Record<string, unknown>} */ (data);
      if (onProgress) onProgress(last);
      const state = last.state || last.job?.state;
      if (state && terminal.has(String(state))) return last;
    }
    await sleep(2000);
  }
  /* eslint-enable no-await-in-loop */

  const details = await fetchJobDetails(daFetch, resolvedJobUrl);
  if (details) return details;
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
    if (self) return rewriteAdminUrl(self);
  }

  if (job && typeof job === 'object') {
    const { name, topic: jobTopic } = /** @type {{ name?: string, topic?: string }} */ (job);
    const resolvedTopic = jobTopic || topic;
    if (name && resolvedTopic) {
      return `${ADMIN_API}/job/${org}/${site}/${ref}/${resolvedTopic}/${name}`;
    }
  }

  return null;
}

/**
 * Path keys to try for GET /status/{org}/{site}/{ref}/{path segments…}
 * @param {string} helixPath
 * @returns {string[]}
 */
export function helixPathToStatusPathKeys(helixPath) {
  const bare = !helixPath || helixPath === '/' ? 'index' : helixPath.replace(/^\//, '');
  const keys = new Set([bare]);
  if (bare === 'index') keys.add('');
  if (bare.endsWith('/index')) {
    const parent = bare.slice(0, -'/index'.length);
    keys.add(parent);
  }
  return [...keys];
}

/**
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string} pathKey helix path without leading slash (empty = site root)
 * @returns {string}
 */
export function buildStatusGetUrl(org, site, ref, pathKey) {
  const prefix = `${ADMIN_API}/status/${encodeURIComponent(org)}/${encodeURIComponent(site)}/${encodeURIComponent(ref)}`;
  if (!pathKey) return `${prefix}/`;
  const segments = pathKey.split('/').filter(Boolean).map((s) => encodeURIComponent(s));
  return `${prefix}/${segments.join('/')}`;
}

/**
 * Paths for bulk status POST (leading slash, per AEM Admin API).
 * @param {string[]} helixPaths
 * @returns {string[]}
 */
export function expandStatusQueryPaths(helixPaths) {
  const out = new Set();
  helixPaths.forEach((hp) => {
    const norm = !hp || hp === '/' ? '/index' : (hp.startsWith('/') ? hp : `/${hp}`);
    out.add(norm);
    if (norm === '/index') {
      out.add('/');
      out.add('/index');
    }
  });
  return [...out];
}

/**
 * @param {unknown} partition
 * @returns {number | undefined}
 */
function partitionTimestamp(partition) {
  if (!partition || typeof partition !== 'object') return undefined;
  const status = Number(/** @type {{ status?: number }} */ (partition).status);
  if (status === 404) return undefined;
  if (status && status >= 400) return undefined;
  const lm = /** @type {{ lastModified?: string, contentBusId?: string, url?: string }} */ (
    partition
  ).lastModified;
  if (lm) {
    const ts = Date.parse(String(lm));
    if (!Number.isNaN(ts)) return ts;
  }
  if (status === 200 || status === 304 || partition.contentBusId) {
    return Date.now();
  }
  return undefined;
}

/**
 * @param {unknown} data
 * @returns {{ previewedAt?: number, publishedAt?: number }}
 */
export function parseStatusPayload(data) {
  if (!data || typeof data !== 'object') return {};
  const { preview, live } = /** @type {{
    preview?: Record<string, unknown>,
    live?: Record<string, unknown>,
  }} */ (data);
  /** @type {{ previewedAt?: number, publishedAt?: number }} */
  const entry = {};
  const previewTs = partitionTimestamp(preview);
  const liveTs = partitionTimestamp(live);
  if (previewTs) entry.previewedAt = previewTs;
  if (liveTs) entry.publishedAt = liveTs;
  return entry;
}

/**
 * @param {string[]} helixPaths
 * @returns {Map<string, string>}
 */
function buildHelixPathLookup(helixPaths) {
  const lookup = new Map();
  const link = (webPath, helix) => {
    const key = normalizeWebPath(webPath);
    if (!lookup.has(key)) lookup.set(key, helix);
    const bare = key.replace(/^\//, '');
    if (bare && bare !== key) lookup.set(bare, helix);
  };
  helixPaths.forEach((helix) => {
    link(helix, helix);
    const norm = normalizeWebPath(helix);
    if (norm === '/index' || norm === '/') {
      link('/', helix);
      link('/index', helix);
      link('index', helix);
    }
  });
  return lookup;
}

/**
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string} helixPath
 */
async function fetchSinglePagePlatformStatus(daFetch, org, site, ref, helixPath) {
  const pathKeys = helixPathToStatusPathKeys(helixPath);
  /** @type {{ previewedAt?: number, publishedAt?: number }} */
  let best = {};

  /* eslint-disable no-await-in-loop -- try path variants until one resolves */
  for (let i = 0; i < pathKeys.length; i += 1) {
    const url = buildStatusGetUrl(org, site, ref, pathKeys[i]);
    let resp;
    try {
      resp = await daFetch(url, { method: 'GET' });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Cannot reach AEM status API (network/CORS). Open this tool from https://da.live Document Authoring.',
        );
      }
      throw err;
    }
    const data = await parseJson(resp);

    if (resp.status === 401 || resp.status === 403) {
      throw new Error(
        `Not authorized to read page status (${resp.status}). Sign in at da.live and open from Document Authoring.`,
      );
    }
    if (!resp.ok && resp.status !== 404) continue;

    const parsed = parseStatusPayload(data);
    if (parsed.previewedAt || parsed.publishedAt) return parsed;
    if (resp.ok) best = parsed;
  }
  /* eslint-enable no-await-in-loop */

  return best;
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
/**
 * @param {Record<string, unknown>} row
 * @returns {{ previewedAt?: number, publishedAt?: number }}
 */
function entryFromStatusRow(row) {
  const entry = parseStatusPayload(row);
  if (row.previewLastModified) {
    const ts = Date.parse(String(row.previewLastModified));
    if (!Number.isNaN(ts)) entry.previewedAt = ts;
  }
  if (row.publishLastModified || row.liveLastModified) {
    const ts = Date.parse(String(row.publishLastModified || row.liveLastModified));
    if (!Number.isNaN(ts)) entry.publishedAt = ts;
  }
  return entry;
}

/**
 * @param {Record<string, { previewedAt?: number, publishedAt?: number }>} result
 * @param {string} helix
 * @param {{ previewedAt?: number, publishedAt?: number }} patch
 */
function mergeEntry(result, helix, patch) {
  const prev = result[helix] || {};
  result[helix] = {
    previewedAt: patch.previewedAt || prev.previewedAt,
    publishedAt: patch.publishedAt || prev.publishedAt,
  };
}

function mapStatusJobToEntries(jobData, helixPaths) {
  /** @type {Record<string, { previewedAt?: number, publishedAt?: number }>} */
  const result = {};
  helixPaths.forEach((p) => { result[p] = {}; });
  const lookup = buildHelixPathLookup(helixPaths);

  const resolveHelix = (webPath) => {
    const key = normalizeWebPath(webPath);
    return lookup.get(key) || lookup.get(key.replace(/^\//, ''));
  };

  const touchEntry = (webPath, bucket, item) => {
    const helix = resolveHelix(webPath);
    if (!helix) return;
    let patch = {};
    if (typeof item === 'string') {
      patch = bucket === 'live' ? { publishedAt: Date.now() } : { previewedAt: Date.now() };
    } else if (item && typeof item === 'object') {
      patch = entryFromStatusRow(/** @type {Record<string, unknown>} */ (item));
    }
    mergeEntry(result, helix, patch);
  };

  extractStatusResources(jobData).forEach((item) => {
    if (typeof item === 'string') {
      touchEntry(item, 'preview', null);
      return;
    }
    const bucket = String(item._bucket || '');
    touchEntry(String(item.webPath || item.path || ''), bucket, item);
  });

  const root = jobData && typeof jobData === 'object'
    ? /** @type {Record<string, unknown>} */ (jobData)
    : null;
  const data = root?.data && typeof root.data === 'object'
    ? /** @type {Record<string, unknown>} */ (root.data)
    : root;
  const resources = data?.resources;
  if (Array.isArray(resources)) {
    resources.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      touchEntry(String(item.webPath || item.path || ''), '', item);
    });
  }

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
  const queryPaths = expandStatusQueryPaths(helixPaths);
  const url = `${ADMIN_API}/status/${org}/${site}/${ref}/*`;
  const resp = await daFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paths: queryPaths,
      select: ['preview', 'live'],
      forceAsync: queryPaths.length > 5,
    }),
  });
  const data = await parseJson(resp);
  if (resp.status === 401 || resp.status === 403) {
    throw new Error(`Not authorized to read page status (${resp.status}). Open from Document Authoring.`);
  }
  if (!resp.ok && resp.status !== 202) {
    throw new Error(
      (data && typeof data === 'object' && (data.message || data.error))
        || `Status check failed (${resp.status})`,
    );
  }

  const jobUrl = getJobPollUrl(data || {}, org, site, ref, 'status');
  if (!jobUrl) {
    if (data && typeof data === 'object') {
      return mapStatusJobToEntries(data, helixPaths);
    }
    return {};
  }

  const finalJob = await pollJob(daFetch, jobUrl);
  let details = finalJob;
  try {
    const detailsResp = await daFetch(`${rewriteAdminUrl(jobUrl)}/details`, { method: 'GET' });
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
/**
 * Per-page GET /status (avoids bulk status jobs that 404 on poll via daFetch).
 * @param {Function} daFetch
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string[]} helixPaths
 */
async function fetchStatusParallel(daFetch, org, site, ref, helixPaths) {
  const unique = dedupePaths(helixPaths);
  /** @type {Record<string, { previewedAt?: number, publishedAt?: number }>} */
  const result = {};
  let index = 0;
  const workers = Math.min(12, Math.max(unique.length, 1));
  const deadline = Date.now() + 90000;

  await Promise.all(Array.from({ length: workers }, async () => {
    while (index < unique.length && Date.now() < deadline) {
      const path = unique[index];
      index += 1;
      try {
        result[path] = await fetchSinglePagePlatformStatus(daFetch, org, site, ref, path);
      } catch (err) {
        if (err instanceof Error && /authorized/i.test(err.message)) throw err;
        result[path] = {};
      }
    }
  }));

  return result;
}

export async function fetchPlatformStatusForPaths(daFetch, org, site, ref, helixPaths) {
  const unique = dedupePaths(helixPaths);
  if (unique.length === 0) return {};
  return fetchStatusParallel(daFetch, org, site, ref, unique);
}
