/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-media variant.
 * Base block: columns
 * Source: https://www.abbvie.com/
 * Selector: .abbvie-container.medium-radius:has(.dark-theme)
 *
 * Columns block structure:
 * Row 1: [heading + description | CTA button]
 */
export default function parse(element, { document }) {
  // Extract heading
  const heading = element.querySelector('.cmp-title__text, h4, h3, h2');

  // Extract description
  const description = element.querySelector('.cmp-text p, p');

  // Extract CTA button
  const cta = element.querySelector('a.cmp-button, .cmp-button');
  const ctaLink = cta ? (cta.closest('a') || cta) : null;

  // Build left column (heading + description)
  const leftCell = [];
  if (heading) leftCell.push(heading);
  if (description) leftCell.push(description);

  // Build right column (CTA)
  const rightCell = [];
  if (ctaLink) {
    const a = document.createElement('a');
    a.href = ctaLink.href || '#';
    a.textContent = ctaLink.textContent.trim();
    rightCell.push(a);
  }

  const cells = [[leftCell, rightCell]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-media', cells });
  element.replaceWith(block);
}
