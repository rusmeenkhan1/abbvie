/* eslint-disable */
/* global WebImporter */
/** Parser for cards-news. Base: cards. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  // Found in DOM: .cardpagestory elements inside .homepage-overlap
  const cardItems = element.querySelectorAll('.cardpagestory, .card-standard');
  const cells = [];

  cardItems.forEach((card) => {
    const image = card.querySelector('img');
    const title = card.querySelector('h4, h3, h2, .card-title, [class*="title"]');
    const description = card.querySelector('p, .card-description, [class*="description"]');
    const date = card.querySelector('.card-metadata-date, [class*="date"]');
    const tag = card.querySelector('.card-metadata-tag, [class*="tag"]');
    const link = card.querySelector('a[href]');

    const imageCell = image || document.createTextNode('');
    const contentCell = [];
    if (tag) contentCell.push(tag);
    if (date) contentCell.push(date);
    if (title) contentCell.push(title);
    if (description) contentCell.push(description);
    if (link && !title?.closest('a')) contentCell.push(link);

    cells.push([imageCell, contentCell]);
  });

  if (cells.length === 0) {
    const fallbackContent = element.querySelector('h2, h3, h4, p');
    if (fallbackContent) cells.push([document.createTextNode(''), fallbackContent]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-news', cells });
  element.replaceWith(block);
}
