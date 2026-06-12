/* eslint-disable no-use-before-define, no-alert, no-await-in-loop */
/* eslint-disable no-restricted-syntax, no-nested-ternary, no-void */
/* eslint-disable no-shadow, no-promise-executor-return, prefer-destructuring */

const SDK_URL = 'https://da.live/nx/utils/sdk.js';
const SDK_TIMEOUT_MS = 8000;
const LIST_BASE = 'https://admin.da.live/list';
const SOURCE_BASE = 'https://admin.da.live/source';
const ADMIN_BASE = 'https://admin.hlx.page';
const SEARCH_MIN_LEN = 3;
const STORE_KEY = 'coh:browse:v1';
const TREE_WALK_CONCURRENCY = 6;

const TEXT = {
  title: 'Content Operations Hub',
  subtitle:
    'Browse folders, select pages, and run bulk preview, publish, or removal at the current directory level.',
  loading: 'Loading content...',
  noContent: 'No folders or pages in this location.',
};

/** @typedef {{ name: string, folderPath: string }} FolderEntry */
/** @typedef {{ name: string, sourcePath: string, helixPath: string }} PageEntry */

/** @type {ReturnType<typeof createState>} */
let state;

function createState() {
  return {
    root: null,
    org: '',
    site: '',
    ref: 'main',
    daFetch: null,
    folderPath: '',
    pageScope: 'folder',
    folders: /** @type {FolderEntry[]} */ ([]),
    pages: /** @type {PageEntry[]} */ ([]),
    selected: new Set(),
    folderSearch: '',
    pageSearch: '',
    loadingContent: false,
    statusText: '',
    statusType: 'info',
    errorText: '',
    job: {
      open: false,
      title: '',
      phase: '',
      processed: 0,
      total: 0,
      failed: 0,
      stateLabel: '',
      cancelLabel: 'Cancel',
      onCancel: /** @type {null | (() => void)} */ (null),
    },
    abortController: /** @type {AbortController | null} */ (null),
  };
}

function h(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function normalizePath(path) {
  if (!path || path === '/') return '';
  return String(path).replace(/^\/+/, '').replace(/\/+$/, '');
}

function joinPath(...parts) {
  return parts
    .map((p) => normalizePath(p))
    .filter(Boolean)
    .join('/');
}

function displayPath(path) {
  const p = normalizePath(path);
  return p ? `/${p}` : 'Site root';
}

function hasExt(name) {
  return /\.[a-z0-9]+$/i.test(name);
}

function toHelixPath(folderPath, fileName) {
  const source = joinPath(folderPath, fileName);
  const noExt = source.replace(/\.[a-z0-9]+$/i, '');
  if (noExt === 'index') return '/';
  if (noExt.endsWith('/index')) return `/${noExt.slice(0, -'/index'.length)}`;
  return `/${noExt}`;
}

function pathToListLabel(helixPath, browseFolder) {
  const absolute = helixPath === '/' ? '/index' : helixPath;
  const folder = normalizePath(browseFolder);
  const prefix = folder ? `/${folder}` : '';
  let rel = absolute;
  if (prefix) {
    if (absolute === prefix) rel = '/';
    else if (absolute.startsWith(`${prefix}/`)) rel = absolute.slice(prefix.length);
  }
  const cleaned = rel === '/' ? 'index' : rel.replace(/^\//, '');
  return cleaned;
}

function buildSiteHost(org, site, ref) {
  return `${ref || 'main'}--${site}--${org}`;
}

function buildEnvUrl(env, path) {
  const host = buildSiteHost(state.org, state.site, state.ref);
  const suffix = path && path !== '/' ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `https://${host}.aem.${env}${suffix}`;
}

function sourcePathToDocPath(sourcePath, helixPath) {
  const src = normalizePath(sourcePath);
  if (src) {
    return hasExt(src) ? src : `${src}.html`;
  }
  const hp = normalizePath(helixPath || '');
  if (!hp) return 'index.html';
  return `${hp}/index.html`;
}

function buildDaEditUrl(page) {
  const docPath = sourcePathToDocPath(page.sourcePath, page.helixPath);
  const refQuery = state.ref && state.ref !== 'main'
    ? `?ref=${encodeURIComponent(state.ref)}`
    : '';
  return `https://da.live/edit${refQuery}#/${state.org}/${state.site}/${docPath}`;
}

function readBrowseMemory() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBrowseMemory() {
  const key = `${state.org}|${state.site}|${state.ref}`;
  const store = readBrowseMemory() || {};
  if (!state.folderPath && state.pageScope === 'folder') {
    delete store[key];
  } else {
    store[key] = {
      folderPath: normalizePath(state.folderPath),
      pageScope: state.pageScope,
    };
  }
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures.
  }
}

function syncUrlAndMemory() {
  const params = new URLSearchParams(window.location.search);
  params.set('ref', state.ref || 'main');

  const folder = normalizePath(state.folderPath);
  if (folder) params.set('path', folder);
  else params.delete('path');

  if (state.pageScope === 'tree') params.set('scope', 'tree');
  else params.delete('scope');

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
  writeBrowseMemory();
}

function filterBySearch(list, term, project) {
  const q = String(term || '')
    .trim()
    .toLowerCase();
  if (!q || q.length < SEARCH_MIN_LEN) return list;
  return list.filter((item) => project(item).toLowerCase().includes(q));
}

function visibleFolders() {
  return filterBySearch(
    state.folders,
    state.folderSearch,
    (f) => `${f.name} ${f.folderPath}`,
  );
}

function visiblePages() {
  const folder = normalizePath(state.folderPath);
  return filterBySearch(state.pages, state.pageSearch, (p) => {
    const label = pathToListLabel(p.helixPath, folder);
    return `${p.name} ${p.helixPath} ${label}`;
  });
}

function selectedPaths() {
  const valid = new Set(state.pages.map((p) => p.helixPath));
  return [...state.selected].filter((p) => valid.has(p));
}

function clearWorkspaceDrafts() {
  state.selected.clear();
  state.pageSearch = '';
  state.folderSearch = '';
}

function clearBrowseSearch() {
  state.pageSearch = '';
  state.folderSearch = '';
}

function pagesByPath() {
  return new Map(state.pages.map((page) => [page.helixPath, page]));
}

function selectedPages(paths = selectedPaths()) {
  const pageIndex = pagesByPath();
  return paths.map((path) => pageIndex.get(path)).filter(Boolean);
}

async function navigateToFolder(folderPath) {
  state.folderPath = normalizePath(folderPath);
  clearBrowseSearch();
  await loadContent();
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function apiFetch(url, initOptions = {}) {
  const response = await state.daFetch(url, initOptions);
  const body = parseJsonSafe(await response.text());
  return { response, body };
}

function classifyEntry(entry) {
  const entryName = extractName(entry);
  const name = String(entry.name || entryName).trim();
  const path = String(
    entry.path || entry.sourcePath || entry.urlPath || entry.pathname || '',
  ).trim();
  const type = String(
    entry.type || entry.kind || entry.resourceType || '',
  ).toLowerCase();
  const contentType = String(
    entry['content-type'] || entry.contentType || '',
  ).toLowerCase();
  const ext = String(
    entry.ext || entryName.match(/\.([a-z0-9]+)$/i)?.[1] || '',
  ).toLowerCase();

  const isFlaggedDirectory = entry.isFolder === true
    || entry.isdir === true
    || entry.isDirectory === true
    || entry.directory === true
    || entry['is-directory'] === true;

  const isFolder = name.endsWith('/')
    || path.endsWith('/')
    || type === 'folder'
    || type === 'directory'
    || type === 'dir'
    || type === 'collection'
    || isFlaggedDirectory
    || contentType.includes('folder');

  if (isFolder) return 'folder';

  const lowerName = entryName.toLowerCase();
  const hasNoExt = !ext && !hasExt(lowerName);
  const looksLikeDocument = contentType.startsWith('text/')
    || contentType.includes('markdown')
    || contentType.includes('html')
    || type === 'file'
    || type === 'document';

  // DA list payloads can omit explicit folder flags. Treat extension-less non-index
  // entries as folders unless other metadata clearly indicates a document.
  if (hasNoExt && lowerName !== 'index' && !looksLikeDocument) return 'folder';

  const isData = [
    'json',
    'yaml',
    'yml',
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'webp',
    'svg',
    'gif',
    'mp4',
  ].includes(ext)
    || contentType.includes('json')
    || contentType.startsWith('image/')
    || contentType.startsWith('video/');

  if (isData) return 'data';
  return 'document';
}

function extractName(entry) {
  const direct = String(entry.name || '').replace(/\/$/, '');
  if (direct) return direct;
  const path = String(entry.path || '');
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

async function listFolderRaw(folderPath) {
  const normalized = normalizePath(folderPath);
  const listUrl = `${LIST_BASE}/${state.org}/${state.site}${normalized ? `/${normalized}` : ''}`;

  const items = [];
  let token = '';

  do {
    const headers = token ? { 'da-continuation-token': token } : undefined;
    const { response, body } = await apiFetch(listUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      const message = (body && (body.message || body.error))
        || `List failed (${response.status})`;
      throw new Error(String(message));
    }

    const batch = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : [];
    items.push(...batch);
    token = response.headers.get('da-continuation-token')
      || response.headers.get('x-da-continuation-token')
      || '';
  } while (token);

  return items;
}

async function listFolderEntries(folderPath) {
  const normalized = normalizePath(folderPath);
  const raw = await listFolderRaw(normalized);

  /** @type {FolderEntry[]} */
  const folders = [];
  /** @type {PageEntry[]} */
  const pages = [];

  raw.forEach((entry) => {
    const kind = classifyEntry(entry);
    const name = extractName(entry);
    if (!name) return;

    if (kind === 'folder') {
      folders.push({
        name,
        folderPath: joinPath(normalized, name),
      });
      return;
    }

    if (kind === 'document') {
      pages.push({
        name,
        sourcePath: joinPath(normalized, name),
        helixPath: toHelixPath(normalized, name),
      });
    }
  });

  folders.sort((a, b) => a.name.localeCompare(b.name));
  pages.sort((a, b) => a.helixPath.localeCompare(b.helixPath));
  return { folders, pages };
}

async function collectPagesRecursive(rootPath) {
  /** @type {PageEntry[]} */
  const allPages = [];
  const queue = [rootPath];

  async function worker() {
    while (queue.length) {
      const folderPath = queue.shift();
      if (folderPath !== undefined) {
        const { folders, pages } = await listFolderEntries(folderPath);
        allPages.push(...pages);
        folders.forEach((folder) => queue.push(folder.folderPath));
      }
    }
  }

  const workerCount = Math.min(
    TREE_WALK_CONCURRENCY,
    Math.max(1, queue.length),
  );
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const byPath = new Map();
  allPages.forEach((page) => byPath.set(page.helixPath, page));
  return [...byPath.values()].sort((a, b) => a.helixPath.localeCompare(b.helixPath));
}

async function loadContent() {
  if (!state.daFetch) {
    state.errorText = 'Sign in using the button in the top right, then reload this tool.';
    render();
    return;
  }

  if (!state.org || !state.site) {
    state.errorText = 'Open Content Operations Hub from your site app in Document Authoring.';
    render();
    return;
  }

  state.loadingContent = true;
  state.errorText = '';
  state.statusText = TEXT.loading;
  state.statusType = 'info';
  render();

  try {
    const listed = await listFolderEntries(state.folderPath);
    state.folders = listed.folders;
    state.pages = state.pageScope === 'tree'
      ? await collectPagesRecursive(state.folderPath)
      : listed.pages;

    state.statusText = state.folders.length || state.pages.length
      ? `Loaded ${state.pages.length} page(s) and ${state.folders.length} folder(s) in ${displayPath(state.folderPath)}.`
      : TEXT.noContent;
    state.statusType = 'info';
  } catch (error) {
    state.folders = [];
    state.pages = [];
    state.selected.clear();
    state.errorText = String(error instanceof Error ? error.message : error);
    state.statusText = state.errorText;
    state.statusType = 'error';
  } finally {
    state.loadingContent = false;
    syncUrlAndMemory();
    render();
  }
}

async function confirmAction(message) {
  return Promise.resolve(window.confirm(message));
}

function openJob(title, total, cancelLabel, onCancel) {
  state.job.open = true;
  state.job.title = title;
  state.job.phase = '';
  state.job.processed = 0;
  state.job.total = total;
  state.job.failed = 0;
  state.job.stateLabel = 'starting';
  state.job.cancelLabel = cancelLabel;
  state.job.onCancel = onCancel;
  render();
}

function closeJob() {
  state.job.open = false;
  state.job.title = '';
  state.job.phase = '';
  state.job.processed = 0;
  state.job.total = 0;
  state.job.failed = 0;
  state.job.stateLabel = '';
  state.job.onCancel = null;
  render();
}

function updateJobProgress({
  processed, total, failed, stateLabel, phase,
}) {
  state.job.processed = processed;
  state.job.total = total;
  state.job.failed = failed;
  state.job.stateLabel = stateLabel;
  state.job.phase = phase || state.job.phase;
  render();
}

function operationRoute(topic) {
  if (topic === 'preview' || topic === 'unpreview') return 'preview';
  return 'live';
}

async function startBulk(topic, paths, remove = false) {
  const route = operationRoute(topic);
  const endpoint = `${ADMIN_BASE}/${route}/${state.org}/${state.site}/${state.ref}/*`;
  const payload = {
    paths,
    forceAsync: paths.length > 5 || remove,
    ...(remove ? { delete: true } : {}),
  };

  const { response, body } = await apiFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status !== 202) {
    const message = (body && (body.message || body.error))
      || `Request failed (${response.status})`;
    throw new Error(String(message));
  }

  return body || {};
}

function jobUrlFromResponse(bulkResponse, topic) {
  const self = bulkResponse?.links?.self;
  if (self) return String(self);
  const jobName = bulkResponse?.job?.name;
  const jobTopic = bulkResponse?.job?.topic || operationRoute(topic);
  if (jobName && jobTopic) {
    return `${ADMIN_BASE}/job/${state.org}/${state.site}/${state.ref}/${jobTopic}/${jobName}`;
  }
  return '';
}

async function pollJob(jobUrl, signal, onProgress) {
  const terminal = new Set(['succeeded', 'failed', 'cancelled', 'stopped']);
  let last = null;

  for (let i = 0; i < 90; i += 1) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

    const { response, body } = await apiFetch(jobUrl, { method: 'GET' });
    if (!response.ok) {
      if (response.status === 404 || response.status === 410) break;
      const message = (body && (body.message || body.error))
        || `Job polling failed (${response.status})`;
      throw new Error(String(message));
    }

    const job = body || {};
    last = job;
    const progress = job.progress || job.job?.progress || {};
    const total = Number(progress.total || 0);
    const processed = Number(progress.processed || 0);
    const failed = Number(progress.failed || 0);
    const stateLabel = String(job.state || job.job?.state || 'running');
    onProgress({
      total,
      processed,
      failed,
      stateLabel,
    });

    if (terminal.has(stateLabel)) return job;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return (
    last || {
      state: 'timeout',
      progress: { processed: 0, total: 0, failed: 0 },
    }
  );
}

function resolveOutcome(job) {
  const stateLabel = String(job?.state || job?.job?.state || 'unknown');
  const progress = job?.progress || job?.job?.progress || {};
  const failed = Number(progress.failed || 0);
  const success = Number(
    progress.success || progress.processed || progress.total || 0,
  );

  if (stateLabel === 'failed' || failed > 0) {
    return {
      type: 'error',
      text: failed > 0 ? `finished with ${failed} failed` : 'failed',
    };
  }
  if (stateLabel === 'cancelled') {
    return { type: 'info', text: 'was cancelled' };
  }
  if (stateLabel === 'timeout') {
    return { type: 'info', text: 'timed out, check server job status' };
  }
  return {
    type: 'success',
    text: `completed successfully${success ? ` (${success} page${success === 1 ? '' : 's'})` : ''}`,
  };
}

async function runBulkDeploy(topic) {
  const paths = selectedPaths();
  if (!paths.length) return;

  const confirmed = await confirmAction(
    topic === 'live'
      ? `Publish ${paths.length} selected page(s) to production?`
      : `Preview ${paths.length} selected page(s)?`,
  );
  if (!confirmed) return;

  clearWorkspaceDrafts();
  state.abortController = new AbortController();

  openJob(
    topic === 'live' ? 'Publishing pages' : 'Previewing pages',
    paths.length,
    'Cancel job',
    () => state.abortController?.abort(),
  );

  try {
    const bulkResponse = await startBulk(topic, paths, false);
    const jobUrl = jobUrlFromResponse(bulkResponse, topic);

    let outcome;
    if (jobUrl) {
      const job = await pollJob(
        jobUrl,
        state.abortController.signal,
        ({
          processed, total, failed, stateLabel,
        }) => {
          updateJobProgress({
            processed,
            total: total || paths.length,
            failed,
            stateLabel,
          });
        },
      );
      outcome = resolveOutcome(job);
    } else {
      outcome = { type: 'success', text: `scheduled (${paths.length} pages)` };
    }

    state.statusText = `${topic === 'live' ? 'Publish' : 'Preview'} ${outcome.text}`;
    state.statusType = outcome.type;

    if (outcome.type === 'error') {
      alert(state.statusText);
    } else if (outcome.type === 'success') {
      const urls = buildUrlsForPaths(
        paths,
        state.org,
        state.site,
        state.ref,
        topic === 'live' ? 'live' : 'page',
      );
      if (urls.length) {
        const host = buildSiteHost(state.org, state.site, state.ref);
        state.statusText = `${state.statusText}. Host: ${host}.`;
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      state.statusText = 'Job tracking cancelled. Server work may still continue.';
      state.statusType = 'info';
    } else {
      state.statusText = String(error instanceof Error ? error.message : error);
      state.statusType = 'error';
      alert(state.statusText);
    }
  } finally {
    state.abortController = null;
    closeJob();
    render();
  }
}

async function runBulkRemove(topic) {
  const paths = selectedPaths();
  if (!paths.length) return;

  const actionLabel = topic === 'unpublish' ? 'unpublish' : 'unpreview';
  const confirmed = await confirmAction(
    `Run ${actionLabel} for ${paths.length} selected page(s)?`,
  );
  if (!confirmed) return;

  clearWorkspaceDrafts();
  state.abortController = new AbortController();

  openJob(
    topic === 'unpublish' ? 'Removing publish' : 'Removing preview',
    paths.length,
    `Cancel ${actionLabel}`,
    () => state.abortController?.abort(),
  );

  try {
    const bulkResponse = await startBulk(topic, paths, true);
    const jobUrl = jobUrlFromResponse(bulkResponse, topic);
    let outcome;

    if (jobUrl) {
      const job = await pollJob(
        jobUrl,
        state.abortController.signal,
        ({
          processed, total, failed, stateLabel,
        }) => {
          updateJobProgress({
            processed,
            total: total || paths.length,
            failed,
            stateLabel,
          });
        },
      );
      outcome = resolveOutcome(job);
    } else {
      outcome = { type: 'success', text: `scheduled (${paths.length} pages)` };
    }

    state.statusText = `${actionLabel} ${outcome.text}`;
    state.statusType = outcome.type;
    if (outcome.type === 'error') alert(state.statusText);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      state.statusText = 'Job tracking cancelled. Server work may still continue.';
      state.statusType = 'info';
    } else {
      state.statusText = String(error instanceof Error ? error.message : error);
      state.statusType = 'error';
      alert(state.statusText);
    }
  } finally {
    state.abortController = null;
    closeJob();
    render();
  }
}

function deletePathForSource(page) {
  const source = normalizePath(page.sourcePath);
  if (!source) {
    const hp = normalizePath(page.helixPath);
    return hp ? `${hp}/index.html` : 'index.html';
  }
  return hasExt(source) ? source : `${source}.html`;
}

async function deleteSourceDocument(page) {
  const deletePath = deletePathForSource(page)
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const url = `${SOURCE_BASE}/${state.org}/${state.site}/${deletePath}`;
  const { response, body } = await apiFetch(url, { method: 'DELETE' });

  if (response.status === 204 || response.status === 404) return;
  const message = (body && (body.message || body.error))
    || `Delete failed (${response.status})`;
  throw new Error(String(message));
}

async function runDeleteFlow() {
  const paths = selectedPaths();
  if (!paths.length) return;

  const confirmed = await confirmAction(
    `Delete ${paths.length} selected page(s) from Document Authoring? This cannot be undone.`,
  );
  if (!confirmed) return;

  clearWorkspaceDrafts();
  state.abortController = new AbortController();

  openJob('Deleting pages', paths.length, 'Cancel delete', () => state.abortController?.abort());

  const pages = selectedPages(paths);

  let errors = 0;

  try {
    const phases = [
      { topic: 'unpreview', label: 'Step 1 of 3 - Remove preview' },
      { topic: 'unpublish', label: 'Step 2 of 3 - Remove publish' },
    ];

    for (const phase of phases) {
      if (state.abortController.signal.aborted) throw new DOMException('Cancelled', 'AbortError');

      state.job.phase = phase.label;
      render();

      const response = await startBulk(phase.topic, paths, true);
      const jobUrl = jobUrlFromResponse(response, phase.topic);
      if (jobUrl) {
        const job = await pollJob(
          jobUrl,
          state.abortController.signal,
          ({
            processed, total, failed, stateLabel,
          }) => {
            updateJobProgress({
              processed,
              total: total || paths.length,
              failed,
              stateLabel,
              phase: phase.label,
            });
          },
        );
        const outcome = resolveOutcome(job);
        if (outcome.type === 'error') errors += 1;
      }
    }

    state.job.phase = 'Step 3 of 3 - Delete source documents';
    render();

    let processed = 0;
    for (const page of pages) {
      if (state.abortController.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      try {
        await deleteSourceDocument(page);
      } catch {
        errors += 1;
      }
      processed += 1;
      updateJobProgress({
        processed,
        total: pages.length,
        failed: errors,
        stateLabel: 'running',
        phase: 'Step 3 of 3 - Delete source documents',
      });
    }

    if (processed > 0) {
      const deletedSet = new Set(paths);
      state.pages = state.pages.filter(
        (page) => !deletedSet.has(page.helixPath),
      );
      paths.forEach((path) => state.selected.delete(path));
    }

    state.statusText = errors
      ? `Delete completed with ${errors} failed operation(s).`
      : `Deleted ${paths.length} page(s) successfully.`;
    state.statusType = errors ? 'error' : 'success';
    if (errors) alert(state.statusText);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      state.statusText = 'Delete tracking cancelled. Server work may still continue.';
      state.statusType = 'info';
    } else {
      state.statusText = String(error instanceof Error ? error.message : error);
      state.statusType = 'error';
      alert(state.statusText);
    }
  } finally {
    state.abortController = null;
    closeJob();
    render();
  }
}

async function runOpenUrls(kind) {
  const paths = selectedPaths();
  if (!paths.length) return;

  const pageIndex = pagesByPath();

  const urls = kind === 'da'
    ? paths
      .map((path) => {
        const page = pageIndex.get(path);
        return page ? buildDaEditUrl(page) : '';
      })
      .filter(Boolean)
    : paths.map((path) => buildEnvUrl(kind === 'live' ? 'live' : 'page', path));

  const confirmed = await confirmAction(
    `Open ${urls.length} URL(s) in new tabs?`,
  );
  if (!confirmed) return;

  clearWorkspaceDrafts();
  render();

  let opened = 0;
  let blocked = 0;
  urls.forEach((url) => {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win === null) {
      opened += 1;
      return;
    }
    try {
      if (win.closed) blocked += 1;
      else opened += 1;
    } catch {
      opened += 1;
    }
  });

  if (blocked > 0 && opened === 0) {
    state.statusText = 'Your browser blocked new tabs. Allow pop-ups for this site.';
    state.statusType = 'error';
    render();
  }
}

async function runAction(action) {
  if (state.loadingContent || state.job.open) return;

  if (action === 'preview' || action === 'live') {
    await runBulkDeploy(action);
    return;
  }
  if (action === 'unpreview' || action === 'unpublish') {
    await runBulkRemove(action);
    return;
  }
  if (action === 'delete') {
    await runDeleteFlow();
    return;
  }
  if (action === 'open-da') {
    await runOpenUrls('da');
    return;
  }
  if (action === 'open-preview') {
    await runOpenUrls('page');
    return;
  }
  if (action === 'open-live') {
    await runOpenUrls('live');
  }
}

function buildHeader() {
  const header = h('header', 'coh-header');
  const top = h('div', 'coh-header-main');
  top.append(
    h('p', 'coh-eyebrow', 'Adobe Experience Manager · Edge Delivery'),
    h('h1', 'coh-title', TEXT.title),
    h('p', 'coh-subtitle', TEXT.subtitle),
  );

  const badges = h('div', 'coh-badges');
  badges.append(
    h('span', 'coh-badge', state.ref || 'main'),
    h('span', 'coh-badge', state.site || '-'),
    h('span', 'coh-badge', state.org || '-'),
  );

  header.append(top, badges);
  return header;
}

function buildSearchInput(value, placeholder, onInput) {
  const wrap = h('div', 'coh-search-wrap');
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'coh-search';
  input.placeholder = placeholder;
  input.value = value;
  input.addEventListener('input', onInput);
  wrap.append(input);
  return wrap;
}

function buildFoldersPane() {
  const pane = h('section', 'coh-pane');
  const head = h('div', 'coh-pane-head');
  head.append(h('h2', 'coh-pane-title', 'Directories'));
  const count = h('span', 'coh-count', String(visibleFolders().length));
  head.append(count);

  const breadcrumb = h('div', 'coh-breadcrumb');
  const normalized = normalizePath(state.folderPath);
  if (!normalized) {
    breadcrumb.append(h('span', 'coh-crumb-current', 'Site root'));
  } else {
    const rootBtn = h('button', 'coh-crumb-btn', 'Site root');
    rootBtn.type = 'button';
    rootBtn.addEventListener('click', async () => navigateToFolder(''));
    breadcrumb.append(rootBtn);

    const segments = normalized.split('/').filter(Boolean);
    segments.forEach((segment, index) => {
      breadcrumb.append(h('span', 'coh-crumb-sep', '›'));
      if (index === segments.length - 1) {
        breadcrumb.append(h('span', 'coh-crumb-current', segment));
      } else {
        const path = segments.slice(0, index + 1).join('/');
        const btn = h('button', 'coh-crumb-btn', segment);
        btn.type = 'button';
        btn.addEventListener('click', async () => navigateToFolder(path));
        breadcrumb.append(btn);
      }
    });
  }

  const search = buildSearchInput(
    state.folderSearch,
    'Search folder',
    (event) => {
      state.folderSearch = /** @type {HTMLInputElement} */ (event.target).value;
      render();
    },
  );

  const listWrap = h('div', 'coh-list-wrap');
  const list = h('ul', 'coh-list');
  const folders = visibleFolders();

  if (!folders.length) {
    list.append(
      h(
        'li',
        'coh-empty',
        state.folderSearch
          ? 'No folders match this search.'
          : 'No subfolders here.',
      ),
    );
  } else {
    folders.forEach((folder) => {
      const row = h('li', 'coh-row coh-folder-row');
      const icon = h('span', 'coh-icon', '📁');
      const btn = h('button', 'coh-folder-btn', folder.name);
      btn.type = 'button';
      btn.addEventListener('click', async () => navigateToFolder(folder.folderPath));
      row.append(icon, btn);
      list.append(row);
    });
  }

  listWrap.append(list);
  pane.append(head, breadcrumb, search, listWrap);
  return pane;
}

function buildPagesPane() {
  const pane = h('section', 'coh-pane');
  const pages = visiblePages();
  const selected = selectedPaths();
  const selectedCount = selected.length;

  const head = h('div', 'coh-pane-head');
  head.append(h('h2', 'coh-pane-title', 'Pages'));
  head.append(h('span', 'coh-count', String(pages.length)));

  const breadcrumb = h('div', 'coh-breadcrumb');
  breadcrumb.append(
    h('span', 'coh-crumb-current', displayPath(state.folderPath)),
  );

  const scopeRow = h('label', 'coh-scope');
  const scope = document.createElement('input');
  scope.type = 'checkbox';
  scope.checked = state.pageScope === 'tree';
  scope.addEventListener('change', async () => {
    state.pageScope = scope.checked ? 'tree' : 'folder';
    state.selected.clear();
    await loadContent();
  });
  scopeRow.append(
    scope,
    document.createTextNode(' Include all subdirectories'),
  );

  const controls = h('div', 'coh-controls');
  const search = buildSearchInput(state.pageSearch, 'Search page', (event) => {
    state.pageSearch = /** @type {HTMLInputElement} */ (event.target).value;
    render();
  });
  const filterStub = h('select', 'coh-filter');
  const option = document.createElement('option');
  option.textContent = 'All pages';
  filterStub.append(option);
  filterStub.disabled = true;
  controls.append(search, filterStub);

  const tools = h('div', 'coh-toolbar');
  tools.append(
    h('span', 'coh-pill', `${selectedCount} selected out of ${pages.length}`),
  );

  const selectAll = h('button', 'coh-btn coh-btn-ghost', 'Select all');
  selectAll.type = 'button';
  selectAll.disabled = !pages.length;
  selectAll.addEventListener('click', () => {
    pages.forEach((page) => state.selected.add(page.helixPath));
    render();
  });

  const clear = h('button', 'coh-btn coh-btn-ghost', 'Clear');
  clear.type = 'button';
  clear.disabled = !selectedCount;
  clear.addEventListener('click', () => {
    pages.forEach((page) => state.selected.delete(page.helixPath));
    render();
  });

  tools.append(selectAll, clear);

  const table = h('div', 'coh-table');
  const header = h('div', 'coh-table-head');
  header.append(
    h('span', '', ''),
    h('span', '', ''),
    h('span', '', 'Name'),
    h('span', '', 'Modified'),
    h('span', '', 'Actions'),
  );

  const rows = h('ul', 'coh-list');
  const browseFolder = normalizePath(state.folderPath);

  if (!state.pages.length) {
    rows.append(h('li', 'coh-empty', 'No pages in this scope.'));
  } else if (!pages.length) {
    rows.append(
      h(
        'li',
        'coh-empty',
        state.pageSearch ? 'No pages match this search.' : 'No pages found.',
      ),
    );
  } else {
    pages.forEach((page) => {
      const row = h('li', 'coh-row coh-page-row');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'coh-checkbox';
      cb.checked = state.selected.has(page.helixPath);
      cb.addEventListener('change', () => {
        if (cb.checked) state.selected.add(page.helixPath);
        else state.selected.delete(page.helixPath);
        render();
      });

      const icon = h('span', 'coh-icon', '📄');
      const name = h(
        'span',
        'coh-page-name',
        pathToListLabel(page.helixPath, browseFolder),
      );
      const modified = h('span', 'coh-muted', '');

      const actions = h('div', 'coh-actions');
      const da = h('a', 'coh-da', 'DA');
      da.href = buildDaEditUrl(page);
      da.target = '_top';
      da.rel = 'noopener noreferrer';
      da.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          (window.top || window).location.assign(da.href);
        } catch {
          window.open(da.href, '_blank', 'noopener,noreferrer');
        }
      });
      actions.append(da);

      row.append(cb, icon, name, modified, actions);
      rows.append(row);
    });
  }

  table.append(header, rows);
  pane.append(head, breadcrumb, scopeRow, controls, tools, table);
  return pane;
}

function buildSelectionBar() {
  const selected = selectedPaths();
  if (!selected.length) return null;

  const bar = h('div', 'coh-selection-bar');
  const left = h('div', 'coh-selection-left');
  left.append(
    h(
      'span',
      'coh-pill',
      selected.length === 1
        ? '1 page selected'
        : `${selected.length} pages selected`,
    ),
  );

  const clear = h('button', 'coh-btn coh-btn-ghost', 'Clear');
  clear.type = 'button';
  clear.addEventListener('click', () => {
    state.selected.clear();
    render();
  });
  left.append(clear);

  const right = h('div', 'coh-selection-right');
  const preview = h('button', 'coh-btn coh-btn-primary', 'Preview');
  preview.type = 'button';
  preview.addEventListener('click', () => void runAction('preview'));

  const publish = h('button', 'coh-btn coh-btn-primary', 'Publish');
  publish.type = 'button';
  publish.addEventListener('click', () => void runAction('live'));

  const more = h('details', 'coh-more');
  const summary = h('summary', 'coh-btn coh-btn-ghost', 'More');
  const menu = h('div', 'coh-menu');

  const items = [
    ['unpreview', 'Remove from preview'],
    ['unpublish', 'Remove from publish'],
    ['delete', 'Delete from DA'],
    ['open-da', 'Open in DA'],
    ['open-preview', 'Open preview URLs (.page)'],
    ['open-live', 'Open publish URLs (.live)'],
  ];

  items.forEach(([key, label]) => {
    const btn = h('button', 'coh-menu-item', label);
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      more.open = false;
      await runAction(key);
    });
    menu.append(btn);
  });

  more.append(summary, menu);
  right.append(preview, publish, more);

  bar.append(left, right);
  return bar;
}

function buildStatus() {
  if (!state.statusText) return null;
  const tone = state.statusType === 'error'
    ? 'coh-status-error'
    : state.statusType === 'success'
      ? 'coh-status-success'
      : 'coh-status-info';
  return h('div', `coh-status ${tone}`, state.statusText);
}

function buildJobModal() {
  if (!state.job.open) return null;

  const backdrop = h('div', 'coh-modal-backdrop');
  const modal = h('div', 'coh-modal');

  const title = h('h3', 'coh-modal-title', state.job.title);
  const phase = h('p', 'coh-modal-phase', state.job.phase || 'Processing...');

  const progressWrap = h('div', 'coh-progress');
  const fill = h('div', 'coh-progress-fill');
  const pct = state.job.total > 0
    ? Math.round((state.job.processed / state.job.total) * 100)
    : 0;
  fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  progressWrap.append(fill);

  const meta = h(
    'p',
    'coh-modal-meta',
    `${state.job.processed} of ${state.job.total} processed${
      state.job.failed ? ` · ${state.job.failed} failed` : ''
    }`,
  );
  const stateLabel = h(
    'p',
    'coh-modal-meta',
    `State: ${state.job.stateLabel || 'running'}`,
  );

  const cancel = h(
    'button',
    'coh-btn coh-btn-danger',
    state.job.cancelLabel || 'Cancel',
  );
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    if (state.job.onCancel) state.job.onCancel();
  });

  modal.append(title, phase, progressWrap, meta, stateLabel, cancel);
  backdrop.append(modal);
  return backdrop;
}

function render() {
  if (!state.root) return;

  state.root.replaceChildren();
  state.root.className = 'coh-app';

  state.root.append(buildHeader());

  const layout = h('div', 'coh-layout');
  if (state.loadingContent) {
    const loading = h('div', 'coh-loading');
    loading.append(h('div', 'coh-spinner'), h('p', '', TEXT.loading));
    layout.append(loading);
  } else if (state.errorText) {
    layout.append(h('div', 'coh-error', state.errorText));
  } else {
    layout.append(buildFoldersPane(), buildPagesPane());
  }

  state.root.append(layout);

  const bar = buildSelectionBar();
  if (bar) state.root.append(bar);

  const status = buildStatus();
  if (status) state.root.append(status);

  const modal = buildJobModal();
  if (modal) state.root.append(modal);
}

async function init() {
  state = createState();
  state.root = document.getElementById('app');
  if (!state.root) return;

  let sdk = null;
  try {
    const timeout = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('DA SDK not available')),
        SDK_TIMEOUT_MS,
      );
    });
    const mod = await import(SDK_URL);
    sdk = await Promise.race([mod.default, timeout]);
  } catch {
    sdk = { context: {}, actions: {} };
  }

  const context = sdk?.context || {};
  const actions = sdk?.actions || {};
  state.daFetch = typeof actions.daFetch === 'function'
    ? (url, initOptions) => actions.daFetch(String(url), initOptions)
    : null;

  state.org = String(context.org || context.owner || '').trim();
  state.site = String(context.repo || context.site || '').trim();
  state.ref = String(context.ref || 'main').trim() || 'main';

  const contextPath = String(context.path || '').trim();
  if ((!state.org || !state.site) && contextPath) {
    const appMatch = contextPath.match(/\/app\/([^/]+)\/([^/]+)\/?/);
    if (appMatch) {
      if (!state.org) state.org = appMatch[1];
      if (!state.site) state.site = appMatch[2];
    }
  }

  const params = new URLSearchParams(window.location.search);
  const urlPath = params.get('path');
  const urlScope = params.get('scope');
  const urlRef = params.get('ref');
  if (urlRef) state.ref = urlRef;

  const store = readBrowseMemory() || {};
  const memory = store[`${state.org}|${state.site}|${state.ref}`] || null;

  state.folderPath = normalizePath(
    urlPath || memory?.folderPath || contextPath,
  );
  if (state.folderPath.startsWith('tools/')) state.folderPath = '';
  state.pageScope = urlScope === 'tree' || urlScope === 'folder'
    ? urlScope
    : memory?.pageScope === 'tree'
      ? 'tree'
      : 'folder';

  render();
  await loadContent();
}

void init();

function buildUrlsForPaths(paths, org, site, ref, env) {
  const host = `${ref || 'main'}--${site}--${org}`;
  return paths.map((path) => {
    const suffix = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
    return `https://${host}.aem.${env}${suffix}`;
  });
}
