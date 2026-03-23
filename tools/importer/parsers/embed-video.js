/* eslint-disable */
/* global WebImporter */

/**
 * Parser for embed-video.
 * Base: embed. Source: https://www.abbvie.com/sustainability/abbvie-foundation/addressing-systemic-barriers.html
 * Extracts poster image and constructs Brightcove video URL.
 *
 * Target structure (embed block library):
 *   Row 1: Poster image (optional) + video URL link
 */
export default function parse(element, { document }) {
  // Extract poster image from the video panel
  const posterImg = element.querySelector('.cmp-video__image img, .cmp-image__image');

  // Try to construct Brightcove video URL from data attributes on the player element
  const videoJsEl = element.querySelector('.video-js, [class*="bc-player"]');
  let videoUrl = '';

  if (videoJsEl) {
    const accountId = videoJsEl.getAttribute('data-account');
    const videoId = videoJsEl.getAttribute('data-video-id');
    const playerId = videoJsEl.getAttribute('data-player') || 'default';

    if (accountId && videoId) {
      videoUrl = `https://players.brightcove.net/${accountId}/${playerId}_default/index.html?videoId=${videoId}`;
    }
  }

  // Fallback: check for YouTube or other video URLs in the element
  if (!videoUrl) {
    const iframe = element.querySelector('iframe[src]');
    if (iframe) {
      videoUrl = iframe.getAttribute('src');
    }
  }

  // Fallback: look for any link with a video URL
  if (!videoUrl) {
    const videoLink = element.querySelector('a[href*="youtube"], a[href*="vimeo"], a[href*="brightcove"]');
    if (videoLink) {
      videoUrl = videoLink.getAttribute('href');
    }
  }

  const cells = [];
  const contentCell = [];

  // Add poster image first (per block library: image above the link)
  if (posterImg) {
    contentCell.push(posterImg);
  }

  // Add video URL as a link
  if (videoUrl) {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.textContent = videoUrl;
    contentCell.push(link);
  }

  if (contentCell.length > 0) {
    cells.push(contentCell);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'embed-video', cells });
  element.replaceWith(block);
}
