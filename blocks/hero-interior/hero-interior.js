export default function decorate(block) {
  const rows = [...block.children];

  if (rows.length === 0) {
    block.style.display = 'none';
    return;
  }

  const firstRowImg = rows[0]?.querySelector('img, picture');
  const hasImageRow = firstRowImg && !rows[0].querySelector('h1, h2');

  const heroImage = document.createElement('div');
  heroImage.className = 'hero-interior-image';

  let contentRow;

  if (hasImageRow) {
    const picture = firstRowImg.closest('picture') || firstRowImg;
    heroImage.append(picture);
    rows[0].replaceWith(heroImage);
    [, contentRow] = rows;
  } else {
    block.prepend(heroImage);
    [contentRow] = rows;
  }

  if (contentRow) {
    contentRow.className = 'hero-interior-content';
    const cols = [...contentRow.children];
    if (cols.length >= 1) {
      cols[0].className = 'hero-interior-heading';
    }
    if (cols.length >= 2) {
      cols[1].className = 'hero-interior-subtitle';
    }
  }
}
