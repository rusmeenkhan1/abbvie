/* eslint-disable */
/* global WebImporter */
/** Parser for hero-video. Base: hero. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  // Extract video poster/background image
  // Found in DOM: <video class="vjs-tech"> with poster, or nearby <img>
  const bgImage = element.querySelector('img, video[poster]');

  // Extract heading
  // Found in DOM: heading elements near the video player
  const heading = element.querySelector('h1, h2, h3, h4');

  // Extract subtitle/description
  const description = element.querySelector('p');

  // Extract CTA (Watch Now button)
  const ctaLink = element.querySelector('a[href]');

  const cells = [];

  // Row 1: Background image (poster)
  if (bgImage) {
    cells.push([bgImage]);
  }

  // Row 2: Content - heading + subtitle + CTA
  const contentCell = [];
  if (heading) contentCell.push(heading);
  if (description) contentCell.push(description);
  if (ctaLink) contentCell.push(ctaLink);
  if (contentCell.length > 0) {
    cells.push(contentCell);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-video', cells });
  element.replaceWith(block);
}
