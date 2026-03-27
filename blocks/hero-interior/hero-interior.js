export default function decorate(block) {
  const rows = [...block.children];

  // If block is empty (the second empty hero-interior in the HTML), hide it
  if (rows.length === 0) {
    block.style.display = 'none';
    return;
  }

  // Row 0: image column
  const imageRow = rows[0];
  const img = imageRow?.querySelector('img');

  // Row 1: content with h1 + subtitle columns
  const contentRow = rows[1];

  // Build the hero structure
  if (img) {
    const heroImage = document.createElement('div');
    heroImage.className = 'hero-interior-image';
    const picture = img.closest('picture') || img;
    heroImage.append(picture);
    imageRow.replaceWith(heroImage);
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
