import { appHooks } from './app-hooks.js';
import { patchStatusBanner } from './status-banner.js';

/**
 * Updates footer status banner and deployment patches without a full render.
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 */
export function patchWorkspaceUi(state) {
  const { root } = state;
  if (!(root instanceof HTMLElement)) return;
  patchStatusBanner(root, state);
  appHooks.refreshDeploymentUi?.(state);
}

/**
 * Patches when workspace is mounted; otherwise falls back to full render.
 * @param {ReturnType<typeof import('./state.js').createAppState>} state
 * @param {{ forceRender?: boolean }} [options]
 */
export function patchOrRender(state, options = {}) {
  const { root } = state;
  if (!(root instanceof HTMLElement)) return;
  const hasWorkspace = Boolean(root.querySelector('.bulk-pp-workspace'));
  if (hasWorkspace && !options.forceRender) {
    patchWorkspaceUi(state);
    return;
  }
  appHooks.render?.(root, state);
}
