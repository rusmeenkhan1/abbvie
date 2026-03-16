/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: AbbVie site cleanup.
 * Selectors from captured DOM of https://www.abbvie.com/
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
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

    // Clean tracking attributes
    element.querySelectorAll('*').forEach((el) => {
      el.removeAttribute('data-track');
      el.removeAttribute('data-analytics');
      el.removeAttribute('onclick');
      el.removeAttribute('data-cmp-data-layer');
    });
  }
}
