export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: background image (optional)
  // Row 1: quote text
  // Row 2: author info [col 0: name (em)] [col 1: title]
  // Row 3: optional - headshot image and/or logo image

  let bgImage = null;
  let quoteRowIndex = 0;

  // Check if first row contains an image (background)
  if (rows[0]) {
    const img = rows[0].querySelector('img, picture');
    if (img && !rows[0].textContent.trim().replace(/\s/g, '')) {
      bgImage = img.closest('picture') || img;
      quoteRowIndex = 1;
    }
  }

  // Background image handling
  if (bgImage) {
    const bgWrapper = document.createElement('div');
    bgWrapper.className = 'quote-partnership-bg';
    bgWrapper.append(bgImage.cloneNode(true));
    block.prepend(bgWrapper);
  }

  // Quote text
  const quoteRow = rows[quoteRowIndex];
  const quoteDiv = document.createElement('div');
  quoteDiv.className = 'quote-partnership-content';

  const quoteTextWrapper = document.createElement('div');
  quoteTextWrapper.className = 'quote-partnership-text-wrapper';

  // Add quote mark
  const quoteMark = document.createElement('span');
  quoteMark.className = 'quote-partnership-mark';
  quoteMark.setAttribute('aria-hidden', 'true');
  quoteMark.innerHTML = '&#x201C;';
  quoteTextWrapper.append(quoteMark);

  if (quoteRow) {
    const quoteText = document.createElement('p');
    quoteText.className = 'quote-partnership-text';
    const innerDiv = quoteRow.querySelector('div > div');
    quoteText.textContent = innerDiv?.textContent?.trim() || quoteRow.textContent?.trim() || '';
    quoteTextWrapper.append(quoteText);
  }

  // Author info
  const authorRow = rows[quoteRowIndex + 1];
  const authorDiv = document.createElement('div');
  authorDiv.className = 'quote-partnership-author';

  if (authorRow) {
    const cols = [...authorRow.children];

    const authorImg = authorRow.querySelector('img, picture');
    if (authorImg) {
      const headshot = document.createElement('div');
      headshot.className = 'quote-partnership-headshot';
      headshot.append(authorImg.closest('picture') || authorImg);
      authorDiv.append(headshot);
    }

    const authorTextDiv = document.createElement('div');
    authorTextDiv.className = 'quote-partnership-author-info';

    const em = authorRow.querySelector('em');
    const nameEl = document.createElement('span');
    nameEl.className = 'quote-partnership-name';
    nameEl.textContent = em?.textContent?.trim() || '';
    authorTextDiv.append(nameEl);

    const titleEl = document.createElement('span');
    titleEl.className = 'quote-partnership-title';
    const allP = authorRow.querySelectorAll('p');
    const titleP = [...allP].find((p) => !p.querySelector('em'));
    titleEl.textContent = titleP?.textContent?.trim() || (cols.length >= 2 ? cols[1].textContent?.trim() : '') || '';
    authorTextDiv.append(titleEl);

    authorDiv.append(authorTextDiv);
  }

  quoteDiv.append(quoteTextWrapper, authorDiv);

  // Logo/additional image (optional - last row if it contains only an image)
  const logoRow = rows[quoteRowIndex + 2];
  let logoDiv = null;
  if (logoRow) {
    const logoImg = logoRow.querySelector('img, picture');
    if (logoImg) {
      logoDiv = document.createElement('div');
      logoDiv.className = 'quote-partnership-logo';
      logoDiv.append(logoImg.closest('picture') || logoImg);
    }
  }

  // Build final layout
  const layout = document.createElement('div');
  layout.className = 'quote-partnership-layout';
  layout.append(quoteDiv);
  if (logoDiv) {
    layout.append(logoDiv);
  }

  // Clear and rebuild
  block.replaceChildren();
  if (bgImage) {
    const bgWrapper = document.createElement('div');
    bgWrapper.className = 'quote-partnership-bg';
    bgWrapper.append(bgImage.cloneNode(true));
    block.append(bgWrapper);
  }
  block.append(layout);
}
