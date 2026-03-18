/* eslint-disable */
/* global WebImporter */

/**
 * Parser for embed-video variant.
 * Base block: embed
 * Source: https://www.abbvie.com/who-we-are/our-principles.html
 * Structure: 1 column, 2 rows: [block name] [poster image + YouTube URL]
 * Source DOM: .video.cmp-video-full-width containing .cmp-video--youtube iframe
 */
export default function parse(element, { document }) {
  // Extract YouTube URL from iframe src
  const iframe = element.querySelector('iframe.youtube-video, iframe[src*="youtube"]');
  let youtubeUrl = '';
  if (iframe) {
    const src = iframe.getAttribute('src') || '';
    // Convert embed URL to watch URL
    const match = src.match(/youtube\.com\/embed\/([^?&]+)/);
    if (match) {
      youtubeUrl = `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }

  // Extract poster/thumbnail image
  const posterImg = element.querySelector('.cmp-video__image img, .cmp-image__image, img');

  // Build cells following embed block library structure:
  // Row 1: poster image (optional) + video URL link
  const contentCell = [];

  if (posterImg) {
    contentCell.push(posterImg);
  }

  if (youtubeUrl) {
    const link = document.createElement('a');
    link.href = youtubeUrl;
    link.textContent = youtubeUrl;
    contentCell.push(link);
  }

  const cells = [];
  if (contentCell.length > 0) {
    cells.push(contentCell);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'embed-video', cells });
  element.replaceWith(block);
}
