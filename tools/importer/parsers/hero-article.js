/* eslint-disable */
/* global WebImporter */

/**
 * Parser: hero-article.
 * Base: hero-interior. Source: abbvie.com/who-we-are/our-stories/*.
 * Extracts hero image from .cmp-container-full-width and story header
 * from adjacent .overlap-predecessor sibling.
 *
 * Block table structure (5 rows):
 *   Row 0: Hero image
 *   Row 1: Back link text | Back link URL
 *   Row 2: Date | Category | Read time
 *   Row 3: H1 title
 *   Row 4: Subtitle text
 */
export default function parse(element, { document }) {
  // Element is the hero image container (.cmp-container-full-width)
  // Find the hero background image
  const heroImg = element.querySelector('.cmp-container__bg-image, img');

  // Find the adjacent overlap predecessor (story header card)
  const overlapEl = element.nextElementSibling;
  const isOverlap = overlapEl && (
    overlapEl.classList.contains('overlap-predecessor')
    || overlapEl.className.includes('overlap-predecessor')
  );
  const headerEl = isOverlap ? overlapEl : null;

  // Extract back link
  const backLinkEl = headerEl?.querySelector('.button.back-cta .cmp-button, .back-cta a');
  const backLinkText = backLinkEl?.querySelector('.cmp-button__text')?.textContent?.trim()
    || backLinkEl?.textContent?.trim()
    || 'All Stories';
  const backLinkHref = backLinkEl?.getAttribute('href') || '/who-we-are/our-stories.html';

  // Extract story metadata
  const storyInfo = headerEl?.querySelector('.storyinfo');
  const storyParagraphs = storyInfo ? [...storyInfo.querySelectorAll('p')] : [];

  // First paragraph contains date and category link
  const firstP = storyParagraphs[0];
  let dateText = '';
  let categoryText = '';
  if (firstP) {
    const catLink = firstP.querySelector('a');
    categoryText = catLink?.textContent?.trim() || '';
    // Date is the text content before the link
    const fullText = firstP.textContent.trim();
    if (catLink && categoryText) {
      dateText = fullText.replace(categoryText, '').trim();
    } else {
      dateText = fullText;
    }
  }

  // Second paragraph is read time
  const readTimeText = storyParagraphs[1]?.textContent?.trim() || '';

  // Extract H1 title
  const h1 = headerEl?.querySelector('h1, .cmp-title__text');
  const titleText = h1?.textContent?.trim() || '';

  // Extract subtitle
  const subtitleEl = headerEl?.querySelector('.text.cmp-text-xx-large .cmp-text, .body-unica-32-reg');
  const subtitleText = subtitleEl?.textContent?.trim() || '';

  // Build cells array matching block table structure
  const cells = [];

  // Row 0: Hero image
  if (heroImg) {
    const img = document.createElement('img');
    img.src = heroImg.src || heroImg.getAttribute('src') || '';
    img.alt = heroImg.alt || heroImg.getAttribute('alt') || '';
    cells.push([img]);
  }

  // Row 1: Back link text | Back link URL
  const backTextEl = document.createTextNode(backLinkText);
  const backUrlLink = document.createElement('a');
  backUrlLink.href = backLinkHref;
  backUrlLink.textContent = backLinkHref;
  cells.push([backTextEl, backUrlLink]);

  // Row 2: Date | Category | Read time
  cells.push([dateText, categoryText, readTimeText]);

  // Row 3: Title
  const titleEl = document.createElement('h1');
  titleEl.textContent = titleText;
  cells.push([titleEl]);

  // Row 4: Subtitle
  const subtitleP = document.createElement('p');
  subtitleP.textContent = subtitleText;
  cells.push([subtitleP]);

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'hero-article',
    cells,
  });

  element.replaceWith(block);

  // Remove the overlap predecessor since its content is now in the block
  if (headerEl) {
    headerEl.remove();
  }
}
