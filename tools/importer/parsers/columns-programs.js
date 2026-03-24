/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-programs.
 * Base: columns. Source: https://www.abbvie.com/science/our-people/community-of-science.html
 * Extracts image + programs list with titles and descriptions separated by dividers.
 *
 * Source HTML structure:
 *   .grid > .grid-container > .grid-row
 *     .grid-row__col-with-6 (image col): .cmp-image > img
 *     .grid-row__col-with-1 (spacer)
 *     .grid-row__col-with-5 (text col): multiple h5 titles + .cmp-text p descriptions
 *       separated by .separator-divider (HR) elements
 *
 * Target structure (columns):
 *   2 columns, 1 row. Col 1: image. Col 2: program titles + descriptions with HRs.
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
    const hasText = col.querySelector('.cmp-title, h5, h4');
    if (img && !imageCol) imageCol = col;
    if (hasText && !textCol) textCol = col;
  });

  // Build image cell
  const imgCell = [];
  if (imageCol) {
    const img = imageCol.querySelector('img');
    if (img) imgCell.push(img);
  }

  // Build text cell - extract program items with separators
  const txtCell = [];
  if (textCol) {
    const titles = textCol.querySelectorAll('h5, h4, .cmp-title__text');
    const texts = textCol.querySelectorAll('.cmp-text p');

    titles.forEach((title, idx) => {
      if (idx > 0) {
        // Add HR between programs
        const hr = document.createElement('hr');
        txtCell.push(hr);
      }
      txtCell.push(title);
      if (texts[idx]) {
        txtCell.push(texts[idx]);
      }
    });
  }

  const cells = [];
  if (imgCell.length > 0 || txtCell.length > 0) {
    cells.push([imgCell.length > 0 ? imgCell : '', txtCell.length > 0 ? txtCell : '']);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-programs', cells });
  element.replaceWith(block);
}
