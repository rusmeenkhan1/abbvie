export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: background image
  // Row 1: quote text
  // Row 2: attribution (name + title)
  // Row 3: logo image

  const bgRow = rows[0];
  const quoteRow = rows[1];
  const attrRow = rows[2];
  const logoRow = rows[3];

  // Convert background image link to img
  if (bgRow) {
    const link = bgRow.querySelector('a[href*="scene7.com/is/image"]');
    if (link) {
      const img = document.createElement('img');
      img.src = link.href;
      img.alt = link.title || link.textContent || '';
      img.loading = 'lazy';
      img.className = 'quote-partnership-bg';
      block.prepend(img);
    }
    bgRow.remove();
  }

  // Mark quote row
  if (quoteRow) {
    quoteRow.className = 'quote-partnership-text';
  }

  // Mark attribution row
  if (attrRow) {
    attrRow.className = 'quote-partnership-attribution';
  }

  // Convert logo image link and mark logo row
  if (logoRow) {
    const link = logoRow.querySelector('a[href*="scene7.com/is/image"]');
    if (link) {
      const img = document.createElement('img');
      img.src = link.href;
      img.alt = link.title || link.textContent || '';
      img.loading = 'lazy';
      const p = link.closest('p');
      if (p) p.replaceWith(img);
      else link.replaceWith(img);
    }
    logoRow.className = 'quote-partnership-logo';
  }
}
