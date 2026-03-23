/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero-interior.
 * Base: hero. Source: https://www.abbvie.com/sustainability/abbvie-foundation/addressing-systemic-barriers.html
 * Extracts background image, H1 heading, intro text, and body paragraphs.
 *
 * Target structure (hero block library):
 *   Row 1: Background image
 *   Row 2: Heading + text content
 */
export default function parse(element, { document }) {
  // Extract background image from the first container
  const bgImage = element.querySelector('.cmp-container__bg-image, img[class*="bg-image"]');

  // Extract heading (H1) from the overlap content area
  const heading = element.querySelector('.cmp-title__text, h1');

  // Extract all text blocks - intro text and body paragraphs
  const textBlocks = element.querySelectorAll('.cmp-text');
  const paragraphs = [];
  textBlocks.forEach((textBlock) => {
    const ps = textBlock.querySelectorAll('p');
    ps.forEach((p) => {
      // Clean up nested spans (light-font, body-unica-32-reg)
      const clone = p.cloneNode(true);
      clone.querySelectorAll('span').forEach((span) => {
        span.replaceWith(...span.childNodes);
      });
      paragraphs.push(clone);
    });
  });

  const cells = [];

  // Row 1: Background image (optional per block library)
  if (bgImage) {
    cells.push([bgImage]);
  }

  // Row 2: Heading + text content
  const contentCell = [];
  if (heading) contentCell.push(heading);
  contentCell.push(...paragraphs);
  if (contentCell.length > 0) {
    cells.push(contentCell);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-interior', cells });
  element.replaceWith(block);
}
