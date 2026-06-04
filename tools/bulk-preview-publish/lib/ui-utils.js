/**
 * @param {string} text
 */
export async function copyTextToClipboard(text) {
  if (!text) throw new Error('Nothing to copy');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Clipboard is not available in this browser');
}

/**
 * @param {HTMLButtonElement} btn
 * @param {string} successLabel
 * @param {string} errorLabel
 * @param {string} defaultLabel
 * @param {() => Promise<void>} action
 */
export async function runButtonAction(btn, successLabel, errorLabel, defaultLabel, action) {
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await action();
    btn.textContent = successLabel;
  } catch {
    btn.textContent = errorLabel;
  }
  setTimeout(() => {
    btn.textContent = defaultLabel;
    btn.disabled = false;
  }, 2200);
}

/**
 * @param {number} opened
 * @param {number} attempted
 */
export function detectPopupBlock(opened, attempted) {
  if (attempted === 0) return false;
  return opened === 0;
}
