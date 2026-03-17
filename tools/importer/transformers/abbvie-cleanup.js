/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: AbbVie site cleanup.
 * Selectors from captured DOM of https://www.abbvie.com/
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Resolve lazy-loaded images: AbbVie uses data-cmp-src on parent divs
    // with placeholder data:image/gif in the actual <img> src
    element.querySelectorAll('div[data-cmp-src]').forEach((div) => {
      const realSrc = div.getAttribute('data-cmp-src');
      const img = div.querySelector('img');
      if (img && realSrc) {
        img.src = realSrc;
      }
    });

    // Also handle img[data-src] and img[data-lazy] patterns
    element.querySelectorAll('img[data-src], img[data-lazy]').forEach((img) => {
      const realSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy');
      if (realSrc && !realSrc.startsWith('data:')) {
        img.src = realSrc;
      }
    });

    // Replace any remaining placeholder data-URI or blob src with empty to avoid errors
    element.querySelectorAll('img').forEach((img) => {
      if (img.src.startsWith('data:') || img.src.startsWith('blob:')) {
        // Check for a data-cmp-src on any ancestor
        const parent = img.closest('[data-cmp-src]');
        if (parent) {
          img.src = parent.getAttribute('data-cmp-src');
        }
      }
    });

    // Strip query params from Scene7 URLs so the Edge Delivery media bus
    // can download them. Presets like ?$Square$, ?$Hero$, ?fmt=webp cause
    // the media bus to fail; bare Scene7 URLs return standard JPEG.
    element.querySelectorAll('img').forEach((img) => {
      if (img.src && img.src.includes('scene7.com/is/image/')) {
        try {
          const u = new URL(img.src);
          u.search = '';
          img.src = u.href;
        } catch (_) { /* ignore malformed URLs */ }
      }
    });

    // Remove cookie consent banner (OneTrust)
    // Found in DOM: <div id="onetrust-consent-sdk">
    WebImporter.DOMUtils.remove(element, [
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '.optanon-alert-box-wrapper',
      '[class*="cookie"]',
    ]);

    // Remove video player artifacts that interfere with parsing
    // Found in DOM: <video class="vjs-tech"> and related elements
    WebImporter.DOMUtils.remove(element, [
      '.vjs-text-track-display',
      '.vjs-loading-spinner',
      '.vjs-control-bar',
      '.vjs-modal-dialog',
      '.vjs-error-display',
      '.vjs-caption-settings',
      '.vjs-poster',
    ]);

    // Remove hidden hero alternatives (only keep active)
    // Found in DOM: <div class="cmp-home-hero__alternative hide">
    WebImporter.DOMUtils.remove(element, [
      '.cmp-home-hero__alternative.hide',
    ]);

    // Remove empty results containers
    // Found in DOM: <div class="stories-empty-results-container hide">
    WebImporter.DOMUtils.remove(element, [
      '.stories-empty-results-container',
      '.cmp-list-buttons',
    ]);
  }

  if (hookName === TransformHook.afterTransform) {
    // Remove non-authorable content: header navigation
    // Found in DOM: <div class="cmp-experiencefragment cmp-experiencefragment--header">
    WebImporter.DOMUtils.remove(element, [
      '.cmp-experiencefragment--header',
      'header.nav-bar',
    ]);

    // Remove non-authorable content: footer
    // Found in DOM: <div class="cmp-experiencefragment cmp-experiencefragment--footer">
    WebImporter.DOMUtils.remove(element, [
      '.cmp-experiencefragment--footer',
    ]);

    // Remove separator elements (decorative only)
    // Found in DOM: <div class="separator separator-height-48">
    WebImporter.DOMUtils.remove(element, [
      '.separator',
      '.cmp-separator',
    ]);

    // Remove iframes, noscript, link elements
    WebImporter.DOMUtils.remove(element, [
      'iframe',
      'noscript',
      'link',
    ]);

    // Remove tracking pixel images (Twitter, analytics, etc.)
    element.querySelectorAll('img').forEach((img) => {
      const src = img.src || '';
      if (src.includes('t.co/') || src.includes('analytics.twitter.com')
        || src.includes('bing.com/c.gif') || src.includes('facebook.com/tr')
        || (!img.alt && (src.includes('adsct') || src.includes('pixel')))) {
        img.remove();
      }
    });

    // Remove links with blob: URLs (video player artifacts)
    element.querySelectorAll('a[href^="blob:"]').forEach((a) => {
      // Keep the content but remove the blob link wrapper
      const parent = a.parentElement;
      while (a.firstChild) parent.insertBefore(a.firstChild, a);
      a.remove();
    });

    // Clean tracking attributes
    element.querySelectorAll('*').forEach((el) => {
      el.removeAttribute('data-track');
      el.removeAttribute('data-analytics');
      el.removeAttribute('onclick');
      el.removeAttribute('data-cmp-data-layer');
    });
  }
}
