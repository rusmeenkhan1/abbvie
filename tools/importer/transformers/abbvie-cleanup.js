/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: AbbVie cleanup.
 * Removes non-authorable content from the AbbVie homepage.
 * Selectors from captured DOM (migration-work/cleaned.html).
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Remove cookie consent banner (OneTrust)
    WebImporter.DOMUtils.remove(element, [
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '#onetrust-pc-sdk',
    ]);

    // Remove skip-to-main-content link
    WebImporter.DOMUtils.remove(element, ['.skip-link', 'a[href="#maincontent"]']);

    // Fix lazy-loaded, blob:, and placeholder images
    element.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      const isPlaceholder = src.startsWith('data:image/gif') || src.startsWith('data:image/svg');
      const isBlob = src.startsWith('blob:');
      const isEmpty = !src;

      if (isPlaceholder || isBlob || isEmpty) {
        // Strategy 1: Check parent .cmp-image for data-cmp-src (AEM lazy loading pattern)
        const cmpImage = img.closest('.cmp-image, [data-cmp-src]');
        if (cmpImage) {
          const cmpSrc = cmpImage.getAttribute('data-cmp-src');
          if (cmpSrc && !cmpSrc.startsWith('blob:') && !cmpSrc.startsWith('data:')) {
            // Normalize Scene7 URLs: replace dynamic params with fmt=webp
            let normalizedSrc = cmpSrc;
            if (cmpSrc.includes('scene7.com/is/image/')) {
              const baseUrl = cmpSrc.split('?')[0];
              normalizedSrc = `${baseUrl}?fmt=webp`;
            }
            img.setAttribute('src', normalizedSrc);
            return;
          }
        }

        // Strategy 2: Check img's own data attributes for original URL
        const dataSrc = img.getAttribute('data-src')
          || img.getAttribute('data-lazy')
          || img.getAttribute('data-original')
          || img.getAttribute('data-lazy-src');
        if (dataSrc && !dataSrc.startsWith('blob:') && !dataSrc.startsWith('data:')) {
          img.setAttribute('src', dataSrc);
          return;
        }

        // Strategy 3: Check parent <picture> > <source> for srcset
        const picture = img.closest('picture');
        if (picture) {
          const sources = picture.querySelectorAll('source[srcset]');
          for (const source of sources) {
            const srcset = source.getAttribute('srcset');
            if (srcset && !srcset.startsWith('blob:') && !srcset.startsWith('data:')) {
              img.setAttribute('src', srcset.split(',')[0].trim().split(' ')[0]);
              return;
            }
          }
        }

        // Strategy 4: Check if there's a noscript sibling with an img (lazy loading pattern)
        const noscript = img.parentElement?.querySelector('noscript');
        if (noscript) {
          const match = noscript.textContent.match(/src=["']([^"']+)["']/);
          if (match) {
            img.setAttribute('src', match[1]);
            return;
          }
        }

        // Strategy 5: Clear invalid src but keep the img for alt text context
        if (isBlob || isPlaceholder) {
          img.removeAttribute('src');
        }
      }
    });

    // Fix video elements with blob: src - keep the element for poster extraction
    element.querySelectorAll('video').forEach((video) => {
      const src = video.getAttribute('src') || '';
      if (src.startsWith('blob:')) {
        video.removeAttribute('src');
      }
    });

    // Remove popup/modal dialogs and cookie consent
    WebImporter.DOMUtils.remove(element, [
      '.xf-popup',
      '.cmp-xfpopup',
      '[class*="popup"]',
      '[role="alertdialog"]',
      '[role="dialog"]',
      '#onetrust-consent-sdk',
    ]);
    // Remove popup button/text elements before they get serialized
    element.querySelectorAll('button, span, p, h5, a').forEach((el) => {
      const text = el.textContent.trim();
      if (text === 'CLOSE' || text === 'Yes, I agree' || text === 'No, I disagree'
        || text.includes('You are about to leave')
        || text.includes('product-specific site Internet site')
        || text === 'Cookies Settings') {
        el.remove();
      }
    });
  }

  if (hookName === TransformHook.afterTransform) {
    // Remove non-authorable site chrome elements
    WebImporter.DOMUtils.remove(element, [
      'header.nav-bar',
      '.cmp-experiencefragment--header',
      '.cmp-experiencefragment--footer',
      'noscript',
      'link',
      'iframe',
    ]);

    // Remove tracking pixel images
    element.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src.includes('t.co/i/adsct')
        || src.includes('analytics.twitter.com')
        || src.includes('metrics.brightcove.com')
        || src.includes('adservice.google.com')
        || src.includes('reddit.com/rp.gif')
        || src.includes('siteimproveanalytics')
        || src.includes('adsrvr.org')
        || src.includes('casalemedia.com')
        || src.includes('google.com/pagead')
        || src.includes('insight.adsrvr.org')) {
        img.remove();
      }
    });

    // Remove any remaining popup/consent text elements
    element.querySelectorAll('button, span, h5, p, a').forEach((el) => {
      const text = el.textContent.trim();
      if (text.includes('You are about to leave')
        || text === 'CLOSE'
        || text === 'No, I disagree'
        || text === 'Yes, I agree'
        || text === 'Cookies Settings'
        || text.includes('product-specific site Internet site')) {
        el.remove();
      }
    });

    // Remove tracking/data attributes from all elements
    element.querySelectorAll('*').forEach((el) => {
      el.removeAttribute('data-track');
      el.removeAttribute('data-analytics');
      el.removeAttribute('onclick');
    });
  }
}
