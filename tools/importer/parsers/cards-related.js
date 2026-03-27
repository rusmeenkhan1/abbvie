/* eslint-disable */
/* global WebImporter */

/**
 * Parser: cards-related.
 * Extracts related story cards from .cardpagestory elements.
 * Source: abbvie.com story pages sidebar.
 *
 * Block table structure (1 row per card):
 *   Col 0: Card image
 *   Col 1: Category (p), Title (strong p), Description (p), CTA link (a)
 */
export default function parse(element, { document }) {
  // Element is a single .cardpagestory card
  // Extract image
  const img = element.querySelector('.card-image, img');

  // Extract metadata
  const dateEl = element.querySelector('.card-metadata-date');
  const categoryEl = element.querySelector('.card-metadata-tag');
  const titleEl = element.querySelector('.card-title, h4');
  const descEl = element.querySelector('.card-description, p.card-description');
  const ctaEl = element.querySelector('.card-cta-read-article');

  // Get the card link URL (the whole card is wrapped in an <a>)
  const cardLink = element.closest('a') || element.querySelector('a');
  const cardHref = cardLink?.getAttribute('href') || '';

  // Build image cell
  const imageCell = [];
  if (img) {
    const newImg = document.createElement('img');
    const srcset = img.closest('picture')?.querySelector('source')?.getAttribute('srcset');
    newImg.src = srcset || img.src || img.getAttribute('src') || '';
    newImg.alt = img.alt || img.getAttribute('alt') || '';
    imageCell.push(newImg);
  }

  // Build content cell: category, title (bold), description, CTA link
  const contentCell = [];

  // Category
  const category = categoryEl?.textContent?.trim() || '';
  if (category) {
    const catP = document.createElement('p');
    catP.textContent = category;
    contentCell.push(catP);
  }

  // Title (bold)
  const title = titleEl?.textContent?.trim() || '';
  if (title) {
    const titleP = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = title;
    titleP.append(strong);
    contentCell.push(titleP);
  }

  // Description
  const desc = descEl?.textContent?.trim() || '';
  if (desc) {
    const descP = document.createElement('p');
    descP.textContent = desc;
    contentCell.push(descP);
  }

  // CTA link
  if (cardHref) {
    const ctaP = document.createElement('p');
    const link = document.createElement('a');
    link.href = cardHref;
    link.textContent = ctaEl?.textContent?.trim() || 'Read story';
    ctaP.append(link);
    contentCell.push(ctaP);
  }

  const cells = [[imageCell, contentCell]];

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'cards-related',
    cells,
  });

  element.replaceWith(block);
}
