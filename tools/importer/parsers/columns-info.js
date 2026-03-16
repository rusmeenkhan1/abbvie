/* eslint-disable */
/* global WebImporter */
/** Parser for columns-info. Base: columns. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  // Investor resources section: eyebrow + heading + description | card with earnings + link list
  // Found in DOM: .container.medium-radius.cmp-container-medium.height-short.align-center

  const teaser = element.querySelector('.cmp-teaser');
  const eyebrow = element.querySelector('.cmp-teaser__pretitle');
  const teaserTitle = element.querySelector('.cmp-teaser__title');
  const teaserDesc = element.querySelector('.cmp-teaser__description');

  // Column 1: Eyebrow + Heading + Description (from teaser)
  const col1 = [];
  if (eyebrow) {
    const em = document.createElement('em');
    em.textContent = eyebrow.textContent.trim();
    const p = document.createElement('p');
    p.appendChild(em);
    col1.push(p);
  }
  if (teaserTitle) {
    const h2 = document.createElement('h2');
    h2.textContent = teaserTitle.textContent.trim();
    col1.push(h2);
  }
  if (teaserDesc) col1.push(teaserDesc);

  // Column 2: Card content (earnings card + resource links)
  const col2 = [];
  const earningsCard = element.querySelector('.cardpagestory, .card-dashboard');
  if (earningsCard) {
    const cardTitle = earningsCard.querySelector('.card-title, h4');
    const cardEyebrow = earningsCard.querySelector('.card-eyebrow');
    const cardLink = earningsCard.querySelector('a[href]');

    if (cardEyebrow) {
      const em = document.createElement('em');
      em.textContent = cardEyebrow.textContent.trim();
      const p = document.createElement('p');
      p.appendChild(em);
      col2.push(p);
    }
    if (cardTitle) col2.push(cardTitle);
    if (cardLink) {
      const a = document.createElement('a');
      a.href = cardLink.href || cardLink.getAttribute('href');
      a.textContent = cardLink.querySelector('.card-cta')?.textContent.trim() || cardLink.textContent.trim();
      const p = document.createElement('p');
      p.appendChild(a);
      col2.push(p);
    }
  }

  // Add resource links from dashboard/link cards
  const linkCards = element.querySelectorAll('.linkcard-link');
  linkCards.forEach((lc) => {
    const a = document.createElement('a');
    a.href = lc.href || lc.getAttribute('href');
    a.textContent = lc.querySelector('.link-text')?.textContent.trim() || lc.textContent.trim();
    const p = document.createElement('p');
    p.appendChild(a);
    col2.push(p);
  });

  const cells = [];
  if (col1.length > 0 || col2.length > 0) {
    cells.push([col1.length > 0 ? col1 : document.createTextNode(''), col2.length > 0 ? col2 : document.createTextNode('')]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-info', cells });
  element.replaceWith(block);
}
