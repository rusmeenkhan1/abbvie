/* eslint-disable */
/* global WebImporter */
/** Parser for cards-dashboard. Base: cards. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  const cardItems = element.querySelectorAll('.cardpagestory, .dashboardcards');
  const cells = [];

  cardItems.forEach((card) => {
    const image = card.querySelector('img');
    const eyebrow = card.querySelector('.card-metadata-tag, [class*="eyebrow"], [class*="tag"]');
    const title = card.querySelector('h2, h3, h4, .card-title, [class*="title"]');
    const stat = card.querySelector('.card-stat, [class*="stat"], [class*="number"]');
    const description = card.querySelector('p, .card-description, [class*="description"]');
    const link = card.querySelector('a[href]');

    const imageCell = image || document.createTextNode('');
    const contentCell = [];
    if (eyebrow) contentCell.push(eyebrow);
    if (stat) contentCell.push(stat);
    if (title) contentCell.push(title);
    if (description) contentCell.push(description);
    if (link && !title?.closest('a')) contentCell.push(link);

    cells.push([imageCell, contentCell]);
  });

  if (cells.length === 0) {
    const fallback = element.querySelector('h2, h3, h4, p');
    if (fallback) cells.push([document.createTextNode(''), fallback]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-dashboard', cells });
  element.replaceWith(block);
}
