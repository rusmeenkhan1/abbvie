/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-showcase.
 * Base: columns. Source: https://www.abbvie.com/science/our-people/community-of-science.html
 * Extracts alternating image/text pairs with eyebrow, title, description.
 *
 * Source HTML structure (per pair):
 *   .grid > .grid-container > .grid-row
 *     .grid-row__col-with-5 (image col): .cmp-image > img
 *     .grid-row__col-with-1 (spacer)
 *     .grid-row__col-with-5 (text col): .cmp-header__text (eyebrow) + h5 (title) + .cmp-text p (desc)
 *     Optional: .cmp-button a (CTA link)
 *
 * Target structure (columns):
 *   2 columns per row. Col 1: image OR text. Col 2: text OR image.
 */
export default function parse(element, { document }) {
  const grids = element.querySelectorAll(':scope .grid');
  const cells = [];

  grids.forEach((grid) => {
    const row = grid.querySelector('.grid-row');
    if (!row) return;

    const cols = row.querySelectorAll(':scope > .grid-cell, :scope > [class*="grid-row__col"]');
    if (cols.length < 2) return;

    let imageCol = null;
    let textCol = null;
    let imageFirst = false;

    // Find image and text columns (skip spacer cols)
    cols.forEach((col, idx) => {
      const img = col.querySelector('.cmp-image__image, img');
      const hasText = col.querySelector('.cmp-header, .cmp-title, .cmp-text, h5, h4, h3');

      if (img && !imageCol) {
        imageCol = col;
        if (!textCol) imageFirst = true;
      }
      if (hasText && !textCol) {
        textCol = col;
      }
    });

    if (!imageCol && !textCol) return;

    // Build image cell
    const imgCell = [];
    if (imageCol) {
      const img = imageCol.querySelector('img');
      if (img) imgCell.push(img);
    }

    // Build text cell
    const txtCell = [];
    if (textCol) {
      const eyebrow = textCol.querySelector('.cmp-header__text, .cmp-header span');
      const heading = textCol.querySelector('h5, h4, h3, .cmp-title__text');
      const textContent = textCol.querySelector('.cmp-text p');
      const ctaLink = textCol.querySelector('.cmp-button, a[class*="cmp-button"]');

      if (eyebrow) {
        const p = document.createElement('p');
        p.textContent = eyebrow.textContent.trim();
        txtCell.push(p);
      }
      if (heading) txtCell.push(heading);
      if (textContent) txtCell.push(textContent);
      if (ctaLink) txtCell.push(ctaLink);
    }

    // Always output image first, text second - CSS handles alternation
    if (imgCell.length > 0 || txtCell.length > 0) {
      cells.push([imgCell.length > 0 ? imgCell : '', txtCell.length > 0 ? txtCell : '']);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-showcase', cells });
  element.replaceWith(block);
}
