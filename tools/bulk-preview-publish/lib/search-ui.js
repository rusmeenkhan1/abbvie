import {
  getVisibleFolders,
  getVisiblePages,
  isStatusLoaded,
  SEARCH_MIN_LEN,
} from './state.js';
import { el } from './dom.js';

/**
 * @param {string} id
 * @param {string} label
 * @param {string} value
 * @param {boolean} disabled
 * @param {string | null} hintText
 */
export function buildSearchField(id, label, value, disabled, hintText) {
  const wrap = el('div', 'bulk-pp-search-field');
  const labelEl = el('label', 'bulk-pp-search-label', label);
  labelEl.htmlFor = id;
  const inputWrap = el('div', 'bulk-pp-search-input-wrap');
  const input = document.createElement('input');
  input.type = 'search';
  input.id = id;
  input.className = 'bulk-pp-search-input';
  input.placeholder = `Search by name (${SEARCH_MIN_LEN}+ characters)`;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.enterKeyHint = 'search';
  input.value = value;
  input.disabled = disabled;
  inputWrap.append(input);
  const hint = el('span', 'bulk-pp-search-hint');
  hint.id = `${id}-hint`;
  if (!hintText) hint.hidden = true;
  else hint.textContent = hintText;
  wrap.append(labelEl, inputWrap, hint);
  return { wrap, input, hint };
}

/**
 * @param {string} draft
 */
export function searchHintText(draft) {
  const q = String(draft || '').trim();
  if (q.length > 0 && q.length < SEARCH_MIN_LEN) {
    return `Type ${SEARCH_MIN_LEN - q.length} more character${q.length === SEARCH_MIN_LEN - 1 ? '' : 's'} to filter`;
  }
  if (q.length >= SEARCH_MIN_LEN) {
    return `Filtering by “${q}”`;
  }
  return null;
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {(folder: { name: string, folderPath: string }, onNavigate: (p: string) => void, locked: boolean) => HTMLElement} buildFolderRow
 */
export function patchFolderSearchResults(root, state, buildFolderRow) {
  const visibleFolders = getVisibleFolders(state);
  const draft = String(state.folderSearch || '').trim();
  const tooShort = draft.length > 0 && draft.length < SEARCH_MIN_LEN;

  const count = root.querySelector('#bulk-pp-folder-count');
  if (count) {
    count.textContent = draft && !tooShort
      ? `${visibleFolders.length} of ${state.folders.length}`
      : String(state.folders.length);
  }

  const hint = root.querySelector('#bulk-pp-folder-search-hint');
  const hintMsg = searchHintText(state.folderSearch);
  if (hint) {
    hint.hidden = !hintMsg;
    if (hintMsg) hint.textContent = hintMsg;
  }

  const list = root.querySelector('#bulk-pp-folder-list');
  if (!list) return;
  list.replaceChildren();
  if (visibleFolders.length === 0) {
    const emptyMsg = tooShort
      ? `Type at least ${SEARCH_MIN_LEN} characters to search.`
      : draft
        ? 'No folders match this search.'
        : 'No folders in this location.';
    list.append(el('li', 'bulk-pp-list-empty', emptyMsg));
  } else {
    visibleFolders.forEach((folder) => {
      list.append(buildFolderRow(
        folder,
        (path) => state.onNavigate(path),
        state.statusChecking,
      ));
    });
  }
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {{ org: string, site: string, ref: string }} siteCtx
 * @param {Function} buildPageRow
 */
export function patchPageSearchResults(root, state, siteCtx, buildPageRow) {
  const { visible: visiblePages, statusMap, browseFolder } = getVisiblePages(state);
  const draft = String(state.pageSearch || '').trim();
  const tooShort = draft.length > 0 && draft.length < SEARCH_MIN_LEN;

  const count = root.querySelector('#bulk-pp-page-count');
  if (count) {
    count.textContent = draft && !tooShort
      ? `${visiblePages.length} of ${state.pages.length}`
      : String(state.pages.length);
  }

  const hint = root.querySelector('#bulk-pp-page-search-hint');
  const hintMsg = searchHintText(state.pageSearch);
  if (hint) {
    hint.hidden = !hintMsg;
    if (hintMsg) hint.textContent = hintMsg;
  }

  const pill = root.querySelector('#bulk-pp-selection-pill');
  if (pill) {
    const visibleCount = visiblePages.length;
    const totalCount = state.pages.length;
    pill.textContent = visibleCount === totalCount
      ? `${state.selected.size} of ${totalCount} selected`
      : `${state.selected.size} selected · ${visibleCount} shown (${totalCount} total)`;
  }

  const selectAllBtn = root.querySelector('#bulk-pp-select-all');
  const selectNoneBtn = root.querySelector('#bulk-pp-select-none');
  const disabled = visiblePages.length === 0 || state.statusChecking;
  if (selectAllBtn instanceof HTMLButtonElement) selectAllBtn.disabled = disabled;
  if (selectNoneBtn instanceof HTMLButtonElement) selectNoneBtn.disabled = disabled;

  const list = root.querySelector('#bulk-pp-page-list');
  if (!list) return;
  list.replaceChildren();
  if (state.pages.length === 0) {
    list.append(el('li', 'bulk-pp-list-empty', 'No pages in this scope.'));
  } else if (visiblePages.length === 0) {
    const emptyMsg = tooShort
      ? `Type at least ${SEARCH_MIN_LEN} characters to search.`
      : draft
        ? 'No pages match this search.'
        : 'No pages match this filter.';
    list.append(el('li', 'bulk-pp-list-empty', emptyMsg));
  } else {
    visiblePages.forEach((page) => {
      list.append(buildPageRow(
        page,
        statusMap[page.helixPath],
        browseFolder,
        state,
        isStatusLoaded(state),
        siteCtx,
        state.statusChecking,
      ));
    });
  }
}

/**
 * @param {HTMLInputElement} input
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {'folder'|'page'} kind
 * @param {() => void} patchFn
 */
export function bindSearchInput(input, state, kind, patchFn) {
  input.addEventListener('input', () => {
    if (kind === 'folder') state.folderSearch = input.value;
    else state.pageSearch = input.value;
    patchFn();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      if (kind === 'folder') state.folderSearch = '';
      else state.pageSearch = '';
      patchFn();
    }
  });
}
