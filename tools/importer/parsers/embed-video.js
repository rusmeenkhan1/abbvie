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
  // Extract YouTube URL from iframe or server-rendered div with data-iframesrc
  // AbbVie pattern: server HTML has <div class="youtube-video" data-iframesrc="...">,
  // JavaScript creates <iframe> at runtime. Check both patterns.
  const iframe = element.querySelector('iframe.youtube-video, iframe[src*="youtube"], iframe[data-iframesrc*="youtube"]');
  const videoDiv = !iframe ? element.querySelector('div.youtube-video[data-iframesrc], [data-iframesrc*="youtube"]') : null;
  let youtubeUrl = '';
  const videoEl = iframe || videoDiv;
  if (videoEl) {
    const src = videoEl.getAttribute('src') || videoEl.getAttribute('data-iframesrc') || '';
    // Convert embed URL to watch URL (handles both youtube.com and youtube-nocookie.com)
    const match = src.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&]+)/);
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
