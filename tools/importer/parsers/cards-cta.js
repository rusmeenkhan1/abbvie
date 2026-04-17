/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-cta variant.
 * Base block: cards
 * Source: https://www.abbvie.com/
 * Selector: .grid:has(.cardpagestory):has(.dashboard-card_link__list)
 *
 * Cards block structure:
 * Each row: [image | text content (eyebrow, title, description/links, CTA)]
 */
export default function parse(element, { document }) {
  const cells = [];

  // Process story cards (with images/content)
  const storyCards = element.querySelectorAll('.cardpagestory');
  storyCards.forEach((card) => {
    const image = card.querySelector('img.card-image, .card-image-container img');
    const eyebrow = card.querySelector('.card-eyebrow');
    const title = card.querySelector('.card-title, h4');
    const description = card.querySelector('.card-description');
    const cta = card.querySelector('.card-cta');
    const link = card.closest('a') || card.querySelector('a');

    const imageCell = image ? [image] : [];
    const textCell = [];
    if (eyebrow) {
      const p = document.createElement('p');
      p.textContent = eyebrow.textContent.trim();
      textCell.push(p);
    }
    if (title) textCell.push(title);
    if (description && description.textContent.trim()) textCell.push(description);
    if (cta && link) {
      const a = document.createElement('a');
      a.href = link.href || '#';
      a.textContent = cta.textContent.trim();
      textCell.push(a);
    }
    cells.push([imageCell, textCell]);
  });

  // Process dashboard link list cards
  const linkCards = element.querySelectorAll('.dashboardcards .dashboard-card_link__list');
  linkCards.forEach((card) => {
    const eyebrow = card.querySelector('.linkcard-eyebrow');
    const title = card.querySelector('.linkcard-title, h5');
    const links = card.querySelectorAll('.linkcard-link');

    const textCell = [];
    if (eyebrow) {
      const p = document.createElement('p');
      p.textContent = eyebrow.textContent.trim();
      textCell.push(p);
    }
    if (title) textCell.push(title);
    links.forEach((link) => {
      const a = document.createElement('a');
      a.href = link.href || '#';
      a.textContent = link.querySelector('.link-text')?.textContent.trim() || link.textContent.trim();
      textCell.push(a);
    });
    cells.push(['', textCell]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-cta', cells });
  element.replaceWith(block);
}
