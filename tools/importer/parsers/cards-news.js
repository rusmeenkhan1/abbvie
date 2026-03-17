/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-news variant.
 * Base block: cards
 * Source: https://www.abbvie.com/
 * Selector: .homepage-overlap
 *
 * Structure: Press Releases carousel (left) + Featured story card (right)
 * Cards block: Each row: [image | text content (title, description, CTA)]
 */
export default function parse(element, { document }) {
  const cells = [];

  // Process carousel press release items (RSS feed)
  const carouselItems = element.querySelectorAll('.carousel-rss__link, .splide__slide a');
  carouselItems.forEach((item) => {
    const eyebrow = item.querySelector('.carousel-rss__eyebrow, .card-eyebrow');
    const title = item.querySelector('.carousel-rss__title, .card-title, p, h4');

    const textCell = [];
    if (eyebrow) {
      const p = document.createElement('p');
      p.textContent = eyebrow.textContent.trim();
      textCell.push(p);
    }
    if (title) {
      const h = document.createElement('h4');
      h.textContent = title.textContent.trim();
      textCell.push(h);
    }
    if (item.href) {
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = 'Read more';
      textCell.push(a);
    }
    if (textCell.length > 0) cells.push(['', textCell]);
  });

  // Process featured story cards (cardpagestory)
  const storyCards = element.querySelectorAll('.cardpagestory');
  storyCards.forEach((card) => {
    const image = card.querySelector('img.card-image, .card-image-container img');
    const eyebrow = card.querySelector('.card-eyebrow, .card-metadata-tag');
    const date = card.querySelector('.card-metadata-date');
    const title = card.querySelector('.card-title, h4, h3');
    const description = card.querySelector('.card-description, p.card-description');
    const cta = card.querySelector('.card-cta, .card-cta-read-article');
    const link = card.closest('a') || card.querySelector('a');

    const imageCell = image ? [image] : [];
    const textCell = [];
    if (date) {
      const p = document.createElement('p');
      p.textContent = date.textContent.trim();
      textCell.push(p);
    }
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
    if (imageCell.length > 0 || textCell.length > 0) {
      cells.push([imageCell.length > 0 ? imageCell : '', textCell]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-news', cells });
  element.replaceWith(block);
}
