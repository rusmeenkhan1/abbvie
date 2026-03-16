/* eslint-disable */
/* global WebImporter */
/** Parser for cards-cta. Base: cards. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  const heading = element.querySelector('h2, h3, h4');
  const description = element.querySelector('p');
  const ctaLink = element.querySelector('a[href]');

  const contentCell = [];
  if (heading) contentCell.push(heading);
  if (description) contentCell.push(description);
  if (ctaLink) contentCell.push(ctaLink);

  const cells = [];
  if (contentCell.length > 0) {
    cells.push(contentCell);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-cta', cells });
  element.replaceWith(block);
}
