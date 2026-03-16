/* eslint-disable */
/* global WebImporter */
/** Parser for cards-text. Base: cards (no images). Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  const textBlocks = element.querySelectorAll('.text, .cmp-text');
  const cells = [];

  textBlocks.forEach((textBlock) => {
    const heading = textBlock.querySelector('h2, h3, h4, h5');
    const paragraphs = textBlock.querySelectorAll('p');
    const link = textBlock.querySelector('a[href]');

    const contentCell = [];
    if (heading) contentCell.push(heading);
    paragraphs.forEach((p) => contentCell.push(p));
    if (link && !heading?.closest('a')) contentCell.push(link);

    if (contentCell.length > 0) {
      cells.push(contentCell);
    }
  });

  if (cells.length === 0) {
    const fallback = element.querySelector('p, h3, h4');
    if (fallback) cells.push([fallback]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-text', cells });
  element.replaceWith(block);
}
