/* eslint-disable */
/* global WebImporter */
/** Parser for columns-intro. Base: columns. Source: https://www.abbvie.com/. */
export default function parse(element, { document }) {
  // Two-column layout: eyebrow + heading | body text
  // Found in DOM: section intro patterns with eyebrow text + h2 heading + body paragraph

  const eyebrow = element.querySelector('[class*="eyebrow"], .cmp-text p:first-child span.light-font');
  const heading = element.querySelector('h2, h1, h3');
  const paragraphs = Array.from(element.querySelectorAll('p')).filter((p) => {
    // Exclude the eyebrow paragraph if it exists
    if (eyebrow && p.contains(eyebrow)) return false;
    return true;
  });
  const link = element.querySelector('a[href]');

  // Column 1: Eyebrow + Heading
  const col1 = [];
  if (eyebrow && !heading?.parentElement?.contains(eyebrow)) col1.push(eyebrow);
  if (heading) col1.push(heading);

  // Column 2: Body text + optional CTA
  const col2 = [];
  paragraphs.forEach((p) => {
    if (!col1.includes(p) && !p.contains(heading)) col2.push(p);
  });
  if (link && !heading?.closest('a')) col2.push(link);

  const cells = [];
  if (col1.length > 0 || col2.length > 0) {
    cells.push([col1.length > 0 ? col1 : document.createTextNode(''), col2.length > 0 ? col2 : document.createTextNode('')]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-intro', cells });
  element.replaceWith(block);
}
