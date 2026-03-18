/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero-interior variant.
 * Base block: hero
 * Source: https://www.abbvie.com/who-we-are/our-principles.html
 * Structure: 1 column, 3 rows: [block name] [background image] [heading + subtitle]
 * Source DOM: .abbvie-container.large-radius.cmp-container-full-width.height-default (bg image)
 *             .abbvie-container.overlap-predecessor (content overlay with heading/subtitle)
 */
export default function parse(element, { document }) {
  // The hero consists of two sibling containers:
  // 1. Background image container: .cmp-container__bg-image
  // 2. Overlap content container: .overlap-predecessor with heading and subtitle

  // Extract background image from the element or its siblings
  const bgImage = element.querySelector('.cmp-container__bg-image, img[class*="bg"]');

  // Content may be in the overlap-predecessor sibling or within the element itself
  const overlapContainer = element.nextElementSibling?.classList?.contains('overlap-predecessor')
    ? element.nextElementSibling
    : element.querySelector('.overlap-predecessor');

  const contentSource = overlapContainer || element;

  // Extract heading (H1 for interior pages)
  const heading = contentSource.querySelector('h1.cmp-title__text, h1, h2.cmp-title__text, h2');

  // Extract subtitle paragraph
  const subtitle = contentSource.querySelector('.cmp-text p, .body-unica-32-reg, p');

  // Build cells following hero block library structure:
  // Row 1: background image (optional)
  // Row 2: heading + subtitle content
  const cells = [];

  if (bgImage) {
    cells.push([bgImage]);
  }

  const contentCell = [];
  if (heading) contentCell.push(heading);
  if (subtitle) contentCell.push(subtitle);
  if (contentCell.length > 0) {
    cells.push(contentCell);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-interior', cells });
  element.replaceWith(block);
}
