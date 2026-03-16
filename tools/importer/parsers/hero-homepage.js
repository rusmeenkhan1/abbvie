/* eslint-disable */
/* global WebImporter */
/** Parser for hero-homepage. Base: hero. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  // Extract background image from the hero container
  // Found in DOM: <img> inside .cmp-home-hero__primary .container.linear-gradient
  const bgImage = element.querySelector('img');

  // Extract heading text
  // Found in DOM: <h2> inside .cmp-container-xx-large
  const heading = element.querySelector('h1, h2, h3');

  // Extract description/body text
  const description = element.querySelector('p');

  // Extract CTA link
  // Found in DOM: <a> elements inside the hero content area
  const ctaLink = element.querySelector('a[href]');

  const cells = [];

  // Row 1: Background image (per hero block library: row 2 = background image)
  if (bgImage) {
    cells.push([bgImage]);
  }

  // Row 2: Content (per hero block library: row 3 = title + subheading + CTA)
  const contentCell = [];
  if (heading) contentCell.push(heading);
  if (description) contentCell.push(description);
  if (ctaLink) contentCell.push(ctaLink);
  if (contentCell.length > 0) {
    cells.push(contentCell);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-homepage', cells });
  element.replaceWith(block);
}
