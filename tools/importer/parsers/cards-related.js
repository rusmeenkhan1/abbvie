/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-related.
 * Base: cards. Source: https://www.abbvie.com/sustainability/abbvie-foundation/addressing-systemic-barriers.html
 * Extracts related content cards with image, date, tag, title, description, and CTA.
 *
 * Target structure (cards block library):
 *   Each row: Col 1 = Image | Col 2 = Title + Description + CTA
 */
export default function parse(element, { document }) {
  // Find all card elements within the container
  const cards = element.querySelectorAll('.cardpagestory, [class*="card-standard"]');
  const cells = [];

  cards.forEach((card) => {
    // Col 1: Card image
    const image = card.querySelector('.card-image, img');

    // Col 2: Text content - build up the content elements
    const contentElements = [];

    // Date
    const date = card.querySelector('.card-metadata-date');
    if (date) {
      const dateParagraph = document.createElement('p');
      dateParagraph.textContent = date.textContent.trim();
      contentElements.push(dateParagraph);
    }

    // Category tag
    const tag = card.querySelector('.card-metadata-tag');
    if (tag) {
      const tagParagraph = document.createElement('p');
      const em = document.createElement('em');
      em.textContent = tag.textContent.trim();
      tagParagraph.append(em);
      contentElements.push(tagParagraph);
    }

    // Title
    const title = card.querySelector('.card-title, h4, h3, h2');
    if (title) {
      contentElements.push(title);
    }

    // Description
    const description = card.querySelector('.card-description, p.card-description');
    if (description) {
      contentElements.push(description);
    }

    // CTA link - wrap CTA text in the card's parent link
    const cardLink = card.querySelector('a[href]');
    const ctaText = card.querySelector('.card-cta-read-article');
    if (cardLink && ctaText) {
      const ctaLink = document.createElement('a');
      ctaLink.href = cardLink.getAttribute('href');
      ctaLink.textContent = ctaText.textContent.trim();
      const ctaParagraph = document.createElement('p');
      ctaParagraph.append(ctaLink);
      contentElements.push(ctaParagraph);
    }

    // Build the row: [image, content]
    if (image || contentElements.length > 0) {
      cells.push([image || '', contentElements]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-related', cells });
  element.replaceWith(block);
}
