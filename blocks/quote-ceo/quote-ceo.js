export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: quote text
  const quoteRow = rows[0];
  const quoteDiv = document.createElement('div');
  quoteDiv.className = 'quote-ceo-text-wrapper';

  // Add quote mark
  const quoteMark = document.createElement('span');
  quoteMark.className = 'quote-ceo-mark';
  quoteMark.setAttribute('aria-hidden', 'true');
  quoteMark.innerHTML = '&#x201C;';
  quoteDiv.append(quoteMark);

  if (quoteRow) {
    const quoteText = document.createElement('p');
    quoteText.className = 'quote-ceo-text';
    const innerDiv = quoteRow.querySelector('div > div');
    quoteText.textContent = innerDiv?.textContent?.trim() || quoteRow.textContent?.trim() || '';
    quoteDiv.append(quoteText);
  }

  // Row 1: author name + title
  const authorRow = rows[1];
  const authorDiv = document.createElement('div');
  authorDiv.className = 'quote-ceo-author';

  if (authorRow) {
    const cols = [...authorRow.children];
    if (cols.length >= 2) {
      const nameEl = document.createElement('span');
      nameEl.className = 'quote-ceo-name';
      // Name is in <em> tag
      const em = cols[0].querySelector('em');
      nameEl.textContent = em?.textContent?.trim() || cols[0].textContent?.trim() || '';
      authorDiv.append(nameEl);

      const titleEl = document.createElement('span');
      titleEl.className = 'quote-ceo-title';
      titleEl.textContent = cols[1].textContent?.trim() || '';
      authorDiv.append(titleEl);
    }
  }

  block.replaceChildren(quoteDiv, authorDiv);
}
