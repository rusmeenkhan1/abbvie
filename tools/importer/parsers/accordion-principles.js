/* eslint-disable */
/* global WebImporter */

/**
 * Parser for accordion-principles variant.
 * Base block: accordion
 * Source: https://www.abbvie.com/who-we-are/our-principles.html
 * Structure: 2 columns, multiple rows: each row = [title | content]
 * Source DOM: .accordion.cmp-accordion-medium with .cmp-accordion__item elements
 */
export default function parse(element, { document }) {
  // Find all accordion items
  const items = element.querySelectorAll('.cmp-accordion__item');
  const cells = [];

  items.forEach((item) => {
    // Extract title from accordion button/title span
    const titleEl = item.querySelector('.cmp-accordion__title');
    const title = titleEl ? titleEl.textContent.trim() : '';

    // Extract content from accordion panel
    const panel = item.querySelector('.cmp-accordion__panel');
    const contentText = panel ? panel.querySelector('.cmp-text p, p') : null;

    // Build row: [title cell | content cell]
    const titleCell = document.createElement('p');
    titleCell.textContent = title;

    if (contentText) {
      cells.push([titleCell, contentText]);
    } else if (panel) {
      cells.push([titleCell, panel]);
    } else {
      const emptyContent = document.createElement('p');
      emptyContent.textContent = '';
      cells.push([titleCell, emptyContent]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-principles', cells });
  element.replaceWith(block);
}
