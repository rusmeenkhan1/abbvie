/* eslint-disable */
/* global WebImporter */

/**
 * Parser for quote-ceo variant.
 * Base block: quote
 * Source: https://www.abbvie.com/who-we-are/our-principles.html
 * Structure: 1 column, 2 rows: [quote text] [attribution name + title]
 * Source DOM: .quote.cmp-quote-large with .cmp-quote__text and .author-name/.author-title
 */
export default function parse(element, { document }) {
  // Extract quote text
  const quoteTextEl = element.querySelector('.cmp-quote__text');
  let quoteText = '';
  if (quoteTextEl) {
    // Remove the quote icon span and get clean text
    const clone = quoteTextEl.cloneNode(true);
    const iconSpan = clone.querySelector('.abbvie-icon-quote');
    if (iconSpan) iconSpan.remove();
    quoteText = clone.textContent.trim();
  }

  // Extract author name and title
  const authorNameEl = element.querySelector('.author-name');
  const authorTitleEl = element.querySelector('.author-title');

  const authorName = authorNameEl ? authorNameEl.textContent.trim() : '';
  const authorTitle = authorTitleEl ? authorTitleEl.textContent.trim() : '';

  // Build cells following quote block structure:
  // Row 1: quote text
  // Row 2: attribution (name + title)
  const cells = [];

  // Row 1: Quote text
  const quoteP = document.createElement('p');
  quoteP.textContent = quoteText;
  cells.push([quoteP]);

  // Row 2: Attribution
  const attributionCell = [];
  if (authorName) {
    const nameP = document.createElement('p');
    const nameEm = document.createElement('em');
    nameEm.textContent = authorName;
    nameP.appendChild(nameEm);
    attributionCell.push(nameP);
  }
  if (authorTitle) {
    const titleP = document.createElement('p');
    titleP.textContent = authorTitle;
    attributionCell.push(titleP);
  }
  if (attributionCell.length > 0) {
    cells.push(attributionCell);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'quote-ceo', cells });
  element.replaceWith(block);
}
