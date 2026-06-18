/** @typedef {{
 *   render: (root: HTMLElement, state: object) => void,
 *   refreshDeploymentUi: (state: object) => void,
 *   applyOperationWorkspaceReset: (state: object) => void,
 * }} AppHooks */

/** @type {Partial<AppHooks>} */
export const appHooks = {};

/**
 * @param {Partial<AppHooks>} hooks
 */
export function configureAppHooks(hooks) {
  Object.assign(appHooks, hooks);
}
