/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-stats.
 * Base: cards (no images). Source: https://www.abbvie.com/science/our-people/community-of-science.html
 * Extracts stat dashboard cards with eyebrow, number, and description.
 *
 * Source HTML structure (per card):
 *   .cmp-dashboardcard > .dashboard-card-facts > .content-container
 *     .eyebrow (pretitle text)
 *     .data-container > .data-point + .data-point-suffix (number)
 *     .description (description text)
 *
 * Target structure (cards no-images):
 *   1 column per row. Each row: pretitle paragraph + h4 number + description paragraph.
 */
export default function parse(element, { document }) {
  const cards = element.querySelectorAll('.cmp-dashboardcard, .dashboard-card-facts');
  const cells = [];

  cards.forEach((card) => {
    const eyebrow = card.querySelector('.eyebrow');
    const dataPoint = card.querySelector('.data-point');
    const dataSuffix = card.querySelector('.data-point-suffix');
    const description = card.querySelector('.description');

    const contentCell = [];

    // Pretitle/eyebrow as paragraph
    if (eyebrow) {
      const p = document.createElement('p');
      p.textContent = eyebrow.textContent.trim();
      contentCell.push(p);
    }

    // Number as h4 (combining data-point + suffix)
    if (dataPoint) {
      const h4 = document.createElement('h4');
      let numberText = dataPoint.textContent.trim();
      if (dataSuffix) numberText += dataSuffix.textContent.trim();
      h4.textContent = numberText;
      contentCell.push(h4);
    }

    // Description as paragraph
    if (description) {
      const p = document.createElement('p');
      p.textContent = description.textContent.trim();
      contentCell.push(p);
    }

    if (contentCell.length > 0) {
      cells.push(contentCell);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-stats', cells });
  element.replaceWith(block);
}
