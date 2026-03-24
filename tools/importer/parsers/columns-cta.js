/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-cta.
 * Base: columns. Source: https://www.abbvie.com/science/our-people/community-of-science.html
 * Extracts image + heading + text + CTA button in two-column layout.
 *
 * Source HTML structure:
 *   .grid > .grid-container > .grid-row
 *     .grid-row__col-with-5 (image col): .cmp-image > img
 *     .grid-row__col-with-1 (spacer)
 *     .grid-row__col-with-5 (text col): h2 heading + .cmp-text p + .cmp-button a
 *
 * Target structure (columns):
 *   2 columns, 1 row. Col 1: image. Col 2: heading + paragraph + CTA link.
 */
export default function parse(element, { document }) {
  const row = element.querySelector('.grid-row');
  if (!row) {
    element.replaceWith(document.createElement('div'));
    return;
  }

  const cols = row.querySelectorAll(':scope > .grid-cell, :scope > [class*="grid-row__col"]');

  let imageCol = null;
  let textCol = null;

  cols.forEach((col) => {
    const img = col.querySelector('.cmp-image__image, img');
    const hasText = col.querySelector('.cmp-title, h2, h3, .cmp-text');
    if (img && !imageCol) imageCol = col;
    if (hasText && !textCol) textCol = col;
  });

  // Build image cell
  const imgCell = [];
  if (imageCol) {
    const img = imageCol.querySelector('img');
    if (img) imgCell.push(img);
  }

  // Build text cell
  const txtCell = [];
  if (textCol) {
    const heading = textCol.querySelector('h2, h3, .cmp-title__text');
    const para = textCol.querySelector('.cmp-text p');
    const ctaLink = textCol.querySelector('.cmp-button, a[class*="cmp-button"]');

    if (heading) txtCell.push(heading);
    if (para) txtCell.push(para);
    if (ctaLink) txtCell.push(ctaLink);
  }

  const cells = [];
  if (imgCell.length > 0 || txtCell.length > 0) {
    cells.push([imgCell.length > 0 ? imgCell : '', txtCell.length > 0 ? txtCell : '']);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-cta', cells });
  element.replaceWith(block);
}
