/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero-homepage variant.
 * Base block: hero
 * Source: https://www.abbvie.com/
 * Selector: .cmp-home-hero
 *
 * Hero block structure (from library):
 * Row 1: Background image
 * Row 2: Heading + subheading + CTA
 */
export default function parse(element, { document }) {
  // Extract background video poster or image (multiple strategies)
  const video = element.querySelector('video');
  const posterSrc = video ? video.getAttribute('poster') : null;
  const bgImage = element.querySelector('.cmp-home-hero__bg-image img, .cmp-image__image, .vjs-poster img');

  // Try to find image from Brightcove player poster
  const vjsPoster = element.querySelector('.vjs-poster');
  let vjsPosterUrl = null;
  if (vjsPoster) {
    const style = vjsPoster.getAttribute('style') || '';
    const match = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
    if (match) vjsPosterUrl = match[1];
  }

  // Try any img element in the hero as fallback
  const anyImg = element.querySelector('img[src]:not([src=""])');

  // Extract heading text
  const heading = element.querySelector('.cmp-title__text, h1, h2');

  // Extract description/subtitle
  const description = element.querySelector('.cmp-text p, .cmp-home-hero__description');

  // Extract CTA link
  const ctaLink = element.querySelector('.cmp-button, a[class*="cta"], a[class*="button"]');

  const cells = [];

  // Row 1: Background image (try poster, bg image, vjs poster, any img)
  if (posterSrc && !posterSrc.startsWith('blob:')) {
    const img = document.createElement('img');
    img.src = posterSrc;
    img.alt = 'Hero background';
    cells.push([img]);
  } else if (bgImage && bgImage.getAttribute('src') && !bgImage.getAttribute('src').startsWith('blob:')) {
    cells.push([bgImage]);
  } else if (vjsPosterUrl && !vjsPosterUrl.startsWith('blob:')) {
    const img = document.createElement('img');
    img.src = vjsPosterUrl;
    img.alt = 'Hero background';
    cells.push([img]);
  } else if (anyImg && anyImg.getAttribute('src') && !anyImg.getAttribute('src').startsWith('blob:')) {
    cells.push([anyImg]);
  } else if (posterSrc) {
    // Even if poster is blob:, include it - WebImporter may resolve it
    const img = document.createElement('img');
    img.src = posterSrc;
    img.alt = 'Hero background';
    cells.push([img]);
  }

  // Row 2: Content (heading + description + CTA)
  const contentCell = [];
  if (heading) contentCell.push(heading);
  if (description) contentCell.push(description);
  if (ctaLink) contentCell.push(ctaLink);
  if (contentCell.length > 0) cells.push(contentCell);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-homepage', cells });
  element.replaceWith(block);
}
