/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-info variant.
 * Base block: columns
 * Source: https://www.abbvie.com/
 * Selector: .cmp-grid-custom:has(.grid-row__col-with-4)
 *
 * Columns block structure:
 * Row 1: [col1 (image + text + CTA) | col2 (image + text + CTA) | col3 (image + text + CTA)]
 */

function findValidImage(container, document) {
  // Try to find an img with a valid (non-blob) src
  const imgs = container.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    if (src && !src.startsWith('blob:') && !src.startsWith('data:image/svg')) {
      return img;
    }
  }
  // Try picture source elements
  const pictures = container.querySelectorAll('picture');
  for (const picture of pictures) {
    const source = picture.querySelector('source[srcset]');
    if (source) {
      const srcset = source.getAttribute('srcset');
      if (srcset && !srcset.startsWith('blob:')) {
        const img = document.createElement('img');
        img.src = srcset.split(',')[0].trim().split(' ')[0];
        img.alt = picture.querySelector('img')?.alt || '';
        return img;
      }
    }
  }
  return null;
}

export default function parse(element, { document }) {
  // Find all grid columns (each has image + text + CTA)
  const gridCols = element.querySelectorAll('.grid-row__col-with-4.grid-cell');

  const colCells = [];

  gridCols.forEach((col) => {
    const image = findValidImage(col, document);
    const text = col.querySelector('.cmp-text p, p');
    const cta = col.querySelector('a.cmp-button, .cmp-button');
    const ctaLink = cta ? (cta.closest('a') || cta) : null;

    const cellContent = [];
    if (image) cellContent.push(image);
    if (text) cellContent.push(text);
    if (ctaLink) {
      const a = document.createElement('a');
      a.href = ctaLink.href || '#';
      a.textContent = ctaLink.textContent.trim();
      cellContent.push(a);
    }
    colCells.push(cellContent);
  });

  const cells = colCells.length > 0 ? [colCells] : [];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-info', cells });
  element.replaceWith(block);
}
