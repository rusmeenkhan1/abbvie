/* eslint-disable no-use-before-define */

import { el } from './dom.js';
import { statusAutoDismissDelay } from './constants.js';
import { isDaAccessError } from './api.js';
import { isProgressModalOpen } from './progress-modal.js';

let transientStatusTimer = 0;
let transientStatusKey = '';

function clearTransientStatusTimers() {
  if (transientStatusTimer) {
    window.clearTimeout(transientStatusTimer);
    transientStatusTimer = 0;
  }
  transientStatusKey = '';
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @returns {HTMLElement | null}
 */
export function buildStatusBanner(state) {
  const {
    status,
    statusType,
    statusChecking,
    contentLoading,
    jobDetail,
  } = state;

  if (
    status
    && !statusChecking
    && !contentLoading
    && !isDaAccessError(status)
    && (statusType === 'error' || statusType === 'info')
  ) {
    const statusEl = el('div', `bulk-pp-status bulk-pp-status-${statusType}`);
    statusEl.setAttribute('role', statusType === 'error' ? 'alert' : 'status');
    statusEl.setAttribute('aria-live', 'polite');
    const body = el('div', 'bulk-pp-status-main');
    const icon = el('span', `bulk-pp-status-icon bulk-pp-status-icon-${statusType}`);
    icon.setAttribute('aria-hidden', 'true');
    const iconSvg = statusType === 'error'
      ? '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"></circle><path d="M8 4.5v4"></path><path d="M8 11.5h.01"></path></svg>'
      : '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7"></path></svg>';
    icon.innerHTML = iconSvg;
    const text = el('div', 'bulk-pp-status-text');
    text.append(el('strong', null, status));
    body.append(icon, text);
    statusEl.append(body);
    if (jobDetail) statusEl.append(el('pre', 'bulk-pp-error-detail', jobDetail));

    const closeBtn = el('button', 'bulk-pp-status-close', 'Dismiss');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Dismiss status message');
    closeBtn.addEventListener('click', () => clearTransientStatus(state));
    statusEl.append(closeBtn);
    return statusEl;
  }

  if (
    jobDetail
    && new URLSearchParams(window.location.search).has('debug')
  ) {
    const statusEl = el('div', 'bulk-pp-status bulk-pp-status-info');
    statusEl.append(el('pre', 'bulk-pp-error-detail', jobDetail));
    return statusEl;
  }

  return null;
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
export function patchStatusBanner(root, state) {
  root.querySelectorAll('.bulk-pp-status').forEach((node) => node.remove());
  root.classList.toggle('bulk-pp-modal-open', isProgressModalOpen());

  const banner = buildStatusBanner(state);
  if (banner) {
    root.append(banner);
    if (state.statusType === 'error' || state.statusType === 'info') {
      scheduleTransientStatusClear(state, state.statusType);
    }
    return;
  }

  clearTransientStatusTimers();
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
export function clearTransientStatus(state) {
  state.status = null;
  state.jobDetail = null;
  clearTransientStatusTimers();
  const { root } = state;
  if (root instanceof HTMLElement) patchStatusBanner(root, state);
}

/**
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {'error'|'success'|'info'} statusType
 */
export function scheduleTransientStatusClear(state, statusType) {
  const statusText = state.status || '';
  const detail = state.jobDetail || '';
  const key = `${statusType}:${statusText}:${detail}`;
  if (transientStatusKey === key && transientStatusTimer) return;
  clearTransientStatusTimers();
  transientStatusKey = key;
  const delay = statusAutoDismissDelay(statusType);
  transientStatusTimer = window.setTimeout(() => {
    if (
      state.status === statusText
      && (state.jobDetail || '') === detail
      && state.statusType === statusType
      && !state.loading
      && !state.statusChecking
      && !state.contentLoading
    ) {
      clearTransientStatus(state);
      return;
    }
    transientStatusTimer = 0;
    transientStatusKey = '';
  }, delay);
}
