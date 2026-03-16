/* eslint-disable */
/* global WebImporter */
/** Parser for footer. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  // Footer with logo, primary nav links, social icons, popular pages, external links, legal text, legal links
  // Found in DOM: .cmp-experiencefragment--footer

  const cells = [];

  // Row 1: Logo + Primary links
  const logo = element.querySelector('.cmp-image--abbvie-logo img, .cmp-image img');
  const primaryList = element.querySelector('.list-footer-primary .cmp-list');
  const row1Col1 = [];
  if (logo) {
    const img = document.createElement('img');
    img.src = logo.src || logo.getAttribute('src');
    img.alt = logo.alt || 'AbbVie';
    row1Col1.push(img);
  }
  const row1Col2 = [];
  if (primaryList) {
    const links = primaryList.querySelectorAll('.cmp-list__item-link');
    links.forEach((link) => {
      const a = document.createElement('a');
      a.href = link.href || link.getAttribute('href');
      a.textContent = link.querySelector('.cmp-list__item-title')?.textContent.trim() || link.textContent.trim();
      const p = document.createElement('p');
      p.appendChild(a);
      row1Col2.push(p);
    });
  }
  if (row1Col1.length > 0 || row1Col2.length > 0) {
    cells.push([row1Col1.length > 0 ? row1Col1 : document.createTextNode(''), row1Col2.length > 0 ? row1Col2 : document.createTextNode('')]);
  }

  // Row 2: Social icons
  const socialList = element.querySelector('.list-icons .cmp-list');
  if (socialList) {
    const socialLinks = socialList.querySelectorAll('.cmp-list__item-link');
    const socialCol = [];
    socialLinks.forEach((link) => {
      const a = document.createElement('a');
      a.href = link.href || link.getAttribute('href');
      const iconImg = link.querySelector('img');
      if (iconImg) {
        const img = document.createElement('img');
        img.src = iconImg.src || iconImg.getAttribute('src');
        img.alt = iconImg.alt || '';
        a.appendChild(img);
      } else {
        a.textContent = link.textContent.trim();
      }
      socialCol.push(a);
    });
    if (socialCol.length > 0) {
      cells.push([socialCol, document.createTextNode('')]);
    }
  }

  // Row 3: Popular pages + External links
  const headers = element.querySelectorAll('.mini-header .cmp-header__text');
  const standardLists = element.querySelectorAll('.list-standard .cmp-list');
  const row3Col1 = [];
  const row3Col2 = [];

  if (headers.length >= 1 && standardLists.length >= 1) {
    const h3a = document.createElement('h3');
    h3a.textContent = headers[0]?.textContent.trim() || 'Popular pages';
    row3Col1.push(h3a);
    const links1 = standardLists[0].querySelectorAll('.cmp-list__item-link');
    links1.forEach((link) => {
      const a = document.createElement('a');
      a.href = link.href || link.getAttribute('href');
      a.textContent = link.querySelector('.cmp-list__item-title')?.textContent.trim() || link.textContent.trim();
      const p = document.createElement('p');
      p.appendChild(a);
      row3Col1.push(p);
    });
  }
  if (headers.length >= 2 && standardLists.length >= 2) {
    const h3b = document.createElement('h3');
    h3b.textContent = headers[1]?.textContent.trim() || 'External links';
    row3Col2.push(h3b);
    const links2 = standardLists[1].querySelectorAll('.cmp-list__item-link');
    links2.forEach((link) => {
      const a = document.createElement('a');
      a.href = link.href || link.getAttribute('href');
      a.textContent = link.querySelector('.cmp-list__item-title')?.textContent.trim() || link.textContent.trim();
      const p = document.createElement('p');
      p.appendChild(a);
      row3Col2.push(p);
    });
  }
  if (row3Col1.length > 0 || row3Col2.length > 0) {
    cells.push([row3Col1.length > 0 ? row3Col1 : document.createTextNode(''), row3Col2.length > 0 ? row3Col2 : document.createTextNode('')]);
  }

  // Row 4: Legal text
  const legalTexts = element.querySelectorAll('.cmp-text-xx-large .cmp-text p');
  if (legalTexts.length > 0) {
    const legalCol = [];
    legalTexts.forEach((p) => {
      const text = p.textContent.trim();
      if (text) {
        const para = document.createElement('p');
        para.textContent = text;
        legalCol.push(para);
      }
    });
    if (legalCol.length > 0) {
      cells.push([legalCol, document.createTextNode('')]);
    }
  }

  // Row 5: Legal links
  const legalList = element.querySelector('.list-footer-legal .cmp-list');
  if (legalList) {
    const legalLinks = legalList.querySelectorAll('.cmp-list__item-link');
    const legalLinksCol = [];
    legalLinks.forEach((link) => {
      const a = document.createElement('a');
      a.href = link.href || link.getAttribute('href');
      a.textContent = link.querySelector('.cmp-list__item-title')?.textContent.trim() || link.textContent.trim();
      legalLinksCol.push(a);
      legalLinksCol.push(document.createTextNode(' | '));
    });
    if (legalLinksCol.length > 1) {
      legalLinksCol.pop(); // Remove trailing separator
      cells.push([legalLinksCol, document.createTextNode('')]);
    }
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'footer', cells });
  element.replaceWith(block);
}
