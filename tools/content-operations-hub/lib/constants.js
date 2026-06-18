/** Shared timing values (milliseconds). */
export const TIMING = {
  SDK_TIMEOUT_MS: 8000,
  COPY_TOAST_MS: 2600,
  STATUS_DISMISS_INFO_MS: 5200,
  STATUS_DISMISS_ERROR_MS: 9000,
  MENU_CLOSE_DELAY_MS: 220,
};

/**
 * @param {'error'|'success'|'info'} statusType
 * @returns {number}
 */
export function statusAutoDismissDelay(statusType) {
  return statusType === 'error'
    ? TIMING.STATUS_DISMISS_ERROR_MS
    : TIMING.STATUS_DISMISS_INFO_MS;
}
