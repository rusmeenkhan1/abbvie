/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-content variant.
 * Base block: columns
 * Source: https://www.abbvie.com/join-us/why-abbvie.html
 * Generated: 2026-03-18
 *
 * Handles image+text side-by-side layouts from AbbVie grid system.
 * Pattern: .grid-row with col-with-5 (image) + col-with-1 (spacer) + col-with-6 (text)
 * Image can be in either column (left or right).
 *
 * Columns block structure (per block library):
 * Row 1: [image column | text column (heading + description + CTA)]
 */
export default function parse(element, { document }) {
  // Find the grid row containing the columns
  const gridRow = element.querySelector('.grid-row');
  if (!gridRow) {
    return;
  }

  // Get all grid cells (skip spacer col-with-1)
  const cells = Array.from(gridRow.querySelectorAll(':scope > [class*="grid-row__col-with"]'))
    .filter((col) => !col.classList.contains('grid-row__col-with-1'));

  if (cells.length < 2) {
    return;
  }

  // Determine which column has the image and which has the text
  let imageCol = null;
  let textCol = null;

  cells.forEach((col) => {
    const hasImage = col.querySelector('.cmp-image img, .cmp-image__image, img');
    if (hasImage && !imageCol) {
      imageCol = col;
    } else {
      textCol = col;
    }
  });

  // Fallback: first col = image, second col = text
  if (!imageCol) {
    imageCol = cells[0];
    textCol = cells[1];
  }
  if (!textCol) {
    textCol = cells[1] || cells[0];
  }

  // Extract image
  const img = imageCol.querySelector('.cmp-image__image, .cmp-image img, img');
  const imageCell = [];
  if (img) {
    imageCell.push(img);
  }

  // Extract text content from the text column
  const textCell = [];

  // Extract eyebrow/header text (e.g., "INVESTMENT", "PIPELINE")
  const headers = textCol.querySelectorAll('.cmp-header__text');

  // Extract headings
  const headings = textCol.querySelectorAll('.cmp-title__text');

  // Extract paragraphs
  const paragraphs = textCol.querySelectorAll('.cmp-text p');

  // Extract CTA links
  const ctas = textCol.querySelectorAll('a.cmp-button');

  // Build text cell content in document order
  // Walk through all content children to preserve source order
  const contentElements = textCol.querySelectorAll('.header, .title, .text, .button');
  contentElements.forEach((el) => {
    if (el.classList.contains('header')) {
      const headerText = el.querySelector('.cmp-header__text');
      if (headerText && headerText.textContent.trim()) {
        const p = document.createElement('p');
        const em = document.createElement('em');
        em.textContent = headerText.textContent.trim();
        p.appendChild(em);
        textCell.push(p);
      }
    } else if (el.classList.contains('title')) {
      const heading = el.querySelector('.cmp-title__text');
      if (heading) {
        textCell.push(heading);
      }
    } else if (el.classList.contains('text')) {
      const p = el.querySelector('.cmp-text p');
      if (p) {
        textCell.push(p);
      }
    } else if (el.classList.contains('button')) {
      const link = el.querySelector('a.cmp-button');
      if (link) {
        const a = document.createElement('a');
        a.href = link.href || link.getAttribute('href') || '#';
        a.textContent = link.textContent.trim() || 'Learn more';
        textCell.push(a);
      }
    }
  });

  // If no structured content found, try generic extraction
  if (textCell.length === 0) {
    headings.forEach((h) => textCell.push(h));
    paragraphs.forEach((p) => textCell.push(p));
    ctas.forEach((a) => {
      const link = document.createElement('a');
      link.href = a.href || a.getAttribute('href') || '#';
      link.textContent = a.textContent.trim() || 'Learn more';
      textCell.push(link);
    });
  }

  // Build columns block: one row with [image column, text column]
  const blockCells = [[imageCell, textCell]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-content', cells: blockCells });
  element.replaceWith(block);
}
