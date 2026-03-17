/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-dashboard variant.
 * Base block: cards
 * Source: https://www.abbvie.com/
 * Selector: .grid-row:has(.cardpagestory):has(.dashboardcards)
 *
 * Cards block structure:
 * Each row: [image | text content (eyebrow, stat/title, description, CTA)]
 */
export default function parse(element, { document }) {
  const cells = [];

  // Process story cards (with images)
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

  // Process dashboard stat cards (no images, have data points)
  const dashCards = element.querySelectorAll('.dashboardcards .dashboard-card-facts');
  dashCards.forEach((card) => {
    const eyebrow = card.querySelector('.eyebrow');
    const dataPoint = card.querySelector('.data-point');
    const dataSuffix = card.querySelector('.data-point-suffix');
    const description = card.querySelector('.description');

    const textCell = [];
    if (eyebrow) {
      const p = document.createElement('p');
      p.textContent = eyebrow.textContent.trim();
      textCell.push(p);
    }
    if (dataPoint) {
      const h = document.createElement('h4');
      h.textContent = (dataPoint.textContent.trim() || '') + (dataSuffix ? dataSuffix.textContent.trim() : '');
      textCell.push(h);
    }
    if (description) {
      const p = document.createElement('p');
      p.textContent = description.textContent.trim();
      textCell.push(p);
    }
    cells.push(['', textCell]);
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

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-dashboard', cells });
  element.replaceWith(block);
}
