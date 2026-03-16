/* eslint-disable */
/* global WebImporter */
/** Parser for columns-media. Base: columns. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  // Two-column layout: image/media | eyebrow + title + description + CTA
  // Found in DOM: .container.cmp-container-xxx-large.height-short with grid layout

  const image = element.querySelector('.cmp-image__image, img');
  const eyebrow = element.querySelector('.cmp-header__text, [class*="eyebrow"]');
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6, .cmp-title__text');
  const description = element.querySelector('.cmp-text p, .cmp-text');
  const link = element.querySelector('a.cmp-button, a[href]');

  // Column 1: Image/media
  const col1 = [];
  if (image) {
    const img = document.createElement('img');
    img.src = image.src || image.getAttribute('src');
    img.alt = image.alt || '';
    col1.push(img);
  }

  // Column 2: Eyebrow + Title + Description + CTA
  const col2 = [];
  if (eyebrow) {
    const em = document.createElement('em');
    em.textContent = eyebrow.textContent.trim();
    const p = document.createElement('p');
    p.appendChild(em);
    col2.push(p);
  }
  if (heading) col2.push(heading);
  if (description) col2.push(description);
  if (link) {
    const a = document.createElement('a');
    a.href = link.href || link.getAttribute('href');
    a.textContent = link.textContent.trim() || 'Learn more';
    const p = document.createElement('p');
    p.appendChild(a);
    col2.push(p);
  }

  const cells = [];
  if (col1.length > 0 || col2.length > 0) {
    cells.push([col1.length > 0 ? col1 : document.createTextNode(''), col2.length > 0 ? col2 : document.createTextNode('')]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-media', cells });
  element.replaceWith(block);
}
