/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-impact.
 * Base: columns. Source: https://www.abbvie.com/sustainability/abbvie-foundation/addressing-systemic-barriers.html
 * Extracts two-column layout: left column (H3 + text), right column (video embed).
 *
 * Target structure (columns block library):
 *   Row 1: Col 1 content | Col 2 content
 *   Each cell can contain text, images, or other inline elements.
 */
export default function parse(element, { document }) {
  // Find the grid row containing the columns
  const gridRow = element.querySelector('.grid-row');
  if (!gridRow) {
    const block = WebImporter.Blocks.createBlock(document, { name: 'columns-impact', cells: [] });
    element.replaceWith(block);
    return;
  }

  // Left column: heading + description text (col-with-4)
  const leftCol = gridRow.querySelector('.grid-row__col-with-4, .grid-cell:first-child');
  const leftContent = [];

  if (leftCol) {
    const heading = leftCol.querySelector('.cmp-title__text, h3, h2');
    if (heading) leftContent.push(heading);

    const textContainer = leftCol.querySelector('.cmp-text');
    if (textContainer) {
      const paragraphs = textContainer.querySelectorAll('p');
      paragraphs.forEach((p) => leftContent.push(p));
    }
  }

  // Right column: video embed (col-with-7)
  const rightCol = gridRow.querySelector('.grid-row__col-with-7, .grid-cell:last-child');
  const rightContent = [];

  if (rightCol) {
    // Extract poster image from video
    const posterImg = rightCol.querySelector('.cmp-video__image img, .cmp-image__image, img');
    if (posterImg) rightContent.push(posterImg);

    // Try to construct Brightcove video URL
    const videoJsEl = rightCol.querySelector('.video-js, [class*="bc-player"]');
    if (videoJsEl) {
      const accountId = videoJsEl.getAttribute('data-account');
      const videoId = videoJsEl.getAttribute('data-video-id');
      const playerId = videoJsEl.getAttribute('data-player') || 'default';

      if (accountId && videoId) {
        const videoUrl = `https://players.brightcove.net/${accountId}/${playerId}_default/index.html?videoId=${videoId}`;
        const link = document.createElement('a');
        link.href = videoUrl;
        link.textContent = videoUrl;
        rightContent.push(link);
      }
    }

    // Fallback: check for iframe
    if (rightContent.length === 0 || (rightContent.length === 1 && posterImg)) {
      const iframe = rightCol.querySelector('iframe[src]');
      if (iframe) {
        const link = document.createElement('a');
        link.href = iframe.getAttribute('src');
        link.textContent = iframe.getAttribute('src');
        rightContent.push(link);
      }
    }
  }

  const cells = [];
  cells.push([leftContent, rightContent]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-impact', cells });
  element.replaceWith(block);
}
