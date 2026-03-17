/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero-video variant.
 * Base block: hero
 * Source: https://www.abbvie.com/
 * Selector: .cmp-video--youtube
 *
 * Hero block structure:
 * Row 1: Video poster image
 * Row 2: Title + subtitle + video URL
 */
export default function parse(element, { document }) {
  // Extract video poster image
  const posterImg = element.querySelector('.cmp-video__poster img, img.cmp-video__poster-image, img');

  // Extract video title
  const title = element.querySelector('.cmp-video__title, h3, h4, .cmp-title__text');

  // Extract video subtitle/description
  const subtitle = element.querySelector('.cmp-video__description, .cmp-text p, p');

  // Extract video URL (YouTube or Brightcove)
  const videoIframe = element.querySelector('iframe[src*="youtube"], iframe[src*="brightcove"]');
  const videoSrc = videoIframe ? videoIframe.src : null;
  const dataVideoId = element.getAttribute('data-video-id') || element.querySelector('[data-video-id]')?.getAttribute('data-video-id');

  const cells = [];

  // Row 1: Poster image
  if (posterImg) {
    cells.push([posterImg]);
  }

  // Row 2: Content (title + subtitle + video link)
  const contentCell = [];
  if (title) contentCell.push(title);
  if (subtitle) contentCell.push(subtitle);
  if (videoSrc) {
    const videoLink = document.createElement('a');
    videoLink.href = videoSrc;
    videoLink.textContent = videoSrc;
    contentCell.push(videoLink);
  } else if (dataVideoId) {
    const videoLink = document.createElement('a');
    videoLink.href = 'https://www.youtube.com/watch?v=' + dataVideoId;
    videoLink.textContent = 'Video';
    contentCell.push(videoLink);
  }
  if (contentCell.length > 0) cells.push(contentCell);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-video', cells });
  element.replaceWith(block);
}
