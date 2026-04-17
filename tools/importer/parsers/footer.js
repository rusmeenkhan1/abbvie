/* eslint-disable */
/* global WebImporter */

/**
 * Parser for footer variant.
 * Source: https://www.abbvie.com/
 * Selector: .cmp-experiencefragment--footer
 *
 * Footer is typically auto-populated in EDS.
 * This parser extracts primary nav links, secondary links, social, and legal text.
 * Deduplicates mobile/desktop nav variants.
 */
export default function parse(element, { document }) {
  const cells = [];
  const seenHrefs = new Set();

  // Helper to create a deduplicated link
  function createLink(href, text) {
    if (!href || seenHrefs.has(href)) return null;
    seenHrefs.add(href);
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text || href;
    return a;
  }

  // Extract primary nav links (Who We Are, Science, etc.)
  const primaryLinks = [];
  const navLinks = element.querySelectorAll('.footer-nav a, .cmp-list a');
  navLinks.forEach((link) => {
    const text = link.textContent.trim();
    const href = link.href;
    if (text && href) {
      const a = createLink(href, text);
      if (a) primaryLinks.push(a);
    }
  });

  // If no structured nav, get all links
  if (primaryLinks.length === 0) {
    element.querySelectorAll('a[href]').forEach((link) => {
      const text = link.textContent.trim();
      const href = link.href;
      if (text && href && !href.includes('#') && !href.includes('facebook') && !href.includes('twitter')
        && !href.includes('instagram') && !href.includes('linkedin') && !href.includes('youtube')
        && !href.includes('tiktok')) {
        const a = createLink(href, text);
        if (a) primaryLinks.push(a);
      }
    });
  }
  if (primaryLinks.length > 0) cells.push([primaryLinks]);

  // Extract social media links
  const socialLinks = [];
  element.querySelectorAll('a[href]').forEach((link) => {
    const href = link.href || '';
    if (href.includes('facebook.com') || href.includes('twitter.com')
      || href.includes('instagram.com') || href.includes('linkedin.com')
      || href.includes('youtube.com') || href.includes('tiktok.com')) {
      const text = link.textContent.trim() || link.getAttribute('aria-label') || new URL(href).hostname.replace('www.', '');
      const a = createLink(href, text);
      if (a) socialLinks.push(a);
    }
  });
  if (socialLinks.length > 0) cells.push([socialLinks]);

  // Extract legal text
  const legalTexts = [];
  element.querySelectorAll('p').forEach((p) => {
    const text = p.textContent.trim();
    if (text.length > 50 && (text.includes('trademark') || text.includes('Copyright') || text.includes('AbbVie Inc'))) {
      if (!legalTexts.some((t) => t.textContent === text)) {
        legalTexts.push(p);
      }
    }
  });
  legalTexts.forEach((p) => cells.push([p]));

  const block = WebImporter.Blocks.createBlock(document, { name: 'footer', cells });
  element.replaceWith(block);
}
