export default function decorate(block) {
  const rows = [...block.children];

  if (rows.length === 0) {
    block.style.display = 'none';
    return;
  }

  const firstRow = rows[0];
  const hasImage = firstRow?.querySelector('img') || firstRow?.querySelector('picture');

  if (hasImage) {
    // Two-row structure: Row 0 = image, Row 1 = content
    const img = firstRow.querySelector('img');
    const heroImage = document.createElement('div');
    heroImage.className = 'hero-interior-image';
    if (img) {
      const picture = img.closest('picture') || img;
      heroImage.append(picture);
    }
    firstRow.replaceWith(heroImage);

    const contentRow = rows[1];
    if (contentRow) {
      contentRow.className = 'hero-interior-content';
      const cols = [...contentRow.children];
      if (cols.length >= 1) cols[0].className = 'hero-interior-heading';
      if (cols.length >= 2) cols[1].className = 'hero-interior-subtitle';
    }
  } else {
    // Single-row structure: content only (no hero image)
    block.classList.add('hero-interior-no-image');
    const heroImage = document.createElement('div');
    heroImage.className = 'hero-interior-image';
    block.prepend(heroImage);

    firstRow.className = 'hero-interior-content';
    const cols = [...firstRow.children];
    if (cols.length >= 1) cols[0].className = 'hero-interior-heading';
    if (cols.length >= 2) cols[1].className = 'hero-interior-subtitle';
  }
}
