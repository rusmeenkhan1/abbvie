/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-related variant.
 * Base block: cards
 * Source: https://www.abbvie.com/who-we-are/our-principles.html
 * Structure: 2 columns, multiple rows: each row = [image | text content]
 * Source DOM: .cardpagestory.card-standard elements within grid-row
 */
export default function parse(element, { document }) {
  // Find all card items
  const cards = element.querySelectorAll('.cardpagestory, [class*="cardpagestory"]');
  const cells = [];

  cards.forEach((card) => {
    // Extract card image
    const img = card.querySelector('.card-image, img');

    // Extract text content
    const eyebrow = card.querySelector('.card-eyebrow');
    const heading = card.querySelector('.card-title, h4, h3');
    const description = card.querySelector('.card-description, p');
    const cta = card.querySelector('.card-cta, a.card-cta');
    const cardLink = card.querySelector('a[href]');

    // Build image cell
    const imageCell = img || document.createElement('span');

    // Build text content cell
    const textCell = [];

    if (eyebrow) {
      const eyebrowP = document.createElement('p');
      eyebrowP.textContent = eyebrow.textContent.trim();
      textCell.push(eyebrowP);
    }

    if (heading) {
      const headingEl = document.createElement('strong');
      headingEl.textContent = heading.textContent.trim();
      const headingP = document.createElement('p');
      headingP.appendChild(headingEl);
      textCell.push(headingP);
    }

    if (description) {
      const descP = document.createElement('p');
      descP.textContent = description.textContent.trim();
      textCell.push(descP);
    }

    // Add CTA link
    if (cardLink) {
      const link = document.createElement('a');
      link.href = cardLink.getAttribute('href') || '';
      link.textContent = cta ? cta.textContent.trim() : 'Learn More';
      const linkP = document.createElement('p');
      linkP.appendChild(link);
      textCell.push(linkP);
    }

    if (textCell.length > 0) {
      cells.push([imageCell, textCell]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-related', cells });
  element.replaceWith(block);
}
