/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-intro variant.
 * Base block: columns
 * Source: https://www.abbvie.com/
 * Selector: .cmp-container:has(.cmp-image--small):has(.cmp-title)
 *
 * Columns block structure:
 * Row 1: [image column | text column (eyebrow + heading + description + CTA)]
 */
export default function parse(element, { document }) {
  // Extract image - try multiple strategies for blob: URL resilience
  let image = null;
  const imgEl = element.querySelector('.cmp-image--small img, .cmp-image img');
  if (imgEl) {
    const src = imgEl.getAttribute('src') || '';
    if (src && !src.startsWith('blob:') && !src.startsWith('data:image/svg')) {
      image = imgEl;
    } else {
      // Try picture source as fallback
      const picture = imgEl.closest('picture');
      if (picture) {
        const source = picture.querySelector('source[srcset]');
        if (source) {
          const srcset = source.getAttribute('srcset');
          if (srcset && !srcset.startsWith('blob:')) {
            image = document.createElement('img');
            image.src = srcset.split(',')[0].trim().split(' ')[0];
            image.alt = imgEl.alt || '';
          }
        }
      }
    }
  }
  // Fallback: any img with valid src in element
  if (!image) {
    element.querySelectorAll('img').forEach((img) => {
      if (image) return;
      const src = img.getAttribute('src') || '';
      if (src && !src.startsWith('blob:') && !src.startsWith('data:image/svg')) {
        image = img;
      }
    });
  }

  // Extract eyebrow text
  const eyebrow = element.querySelector('.cmp-teaser__pretitle, .cmp-text p:first-child');

  // Extract heading
  const heading = element.querySelector('.cmp-title__text, h3, h4, h5');

  // Extract description
  const descriptions = element.querySelectorAll('.cmp-text p');
  let description = null;
  if (descriptions.length > 1) {
    description = descriptions[descriptions.length - 1];
  } else if (descriptions.length === 1 && !eyebrow) {
    description = descriptions[0];
  }

  // Extract CTA link
  const cta = element.querySelector('a.cmp-button, a[class*="cta"], .cmp-button');

  // Build image column
  const imageCell = image ? [image] : [];

  // Build text column
  const textCell = [];
  if (eyebrow && eyebrow.textContent.trim()) {
    const p = document.createElement('p');
    p.textContent = eyebrow.textContent.trim();
    textCell.push(p);
  }
  if (heading) textCell.push(heading);
  if (description) textCell.push(description);
  if (cta) {
    const a = document.createElement('a');
    a.href = cta.href || cta.closest('a')?.href || '#';
    a.textContent = cta.textContent.trim() || 'Learn more';
    textCell.push(a);
  }

  const cells = [[imageCell, textCell]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-intro', cells });
  element.replaceWith(block);
}
