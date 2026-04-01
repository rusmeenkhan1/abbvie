export default function decorate(block) {
  const rows = [...block.children];

  if (rows.length === 0) {
    block.style.display = 'none';
    return;
  }

  // Row 0: image
  const imageRow = rows[0];
  const img = imageRow?.querySelector('img');

  // Row 1: back link (text | URL)
  const backLinkRow = rows[1];

  // Row 2: metadata (date | category | read time)
  const metaRow = rows[2];

  // Row 3: h1 title
  const titleRow = rows[3];

  // Row 4: subtitle
  const subtitleRow = rows[4];

  // Build hero image
  if (img) {
    const heroImage = document.createElement('div');
    heroImage.className = 'hero-article-image';
    const picture = img.closest('picture') || img;
    heroImage.append(picture);
    imageRow.replaceWith(heroImage);
  }

  // Build content overlay
  const content = document.createElement('div');
  content.className = 'hero-article-content';

  // Back link
  if (backLinkRow) {
    const cols = [...backLinkRow.children];
    const linkText = cols[0]?.textContent?.trim() || 'All Stories';
    const linkUrl = cols[1]?.querySelector('a')?.href || cols[1]?.textContent?.trim() || '/who-we-are/our-stories.html';
    const backLink = document.createElement('a');
    backLink.className = 'hero-article-back';
    backLink.href = linkUrl;
    backLink.textContent = linkText;
    content.append(backLink);
    backLinkRow.remove();
  }

  // Story metadata
  if (metaRow) {
    const cols = [...metaRow.children];
    const meta = document.createElement('div');
    meta.className = 'hero-article-meta';

    let date;
    let category;
    let readTime;

    if (cols.length >= 3) {
      // 3-column: date | category | readTime
      date = cols[0]?.textContent?.trim();
      category = cols[1]?.textContent?.trim();
      readTime = cols[2]?.textContent?.trim();
    } else {
      // 2-column: category | readTime (date injected by scripts.js)
      category = cols[0]?.textContent?.trim();
      readTime = cols[1]?.textContent?.trim();
    }

    if (date) {
      const dateSpan = document.createElement('span');
      dateSpan.className = 'hero-article-date';
      dateSpan.textContent = date;
      meta.append(dateSpan);
    }
    if (category) {
      const catSpan = document.createElement('span');
      catSpan.className = 'hero-article-category';
      catSpan.textContent = category;
      meta.append(catSpan);
    }
    if (readTime) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'hero-article-readtime';
      timeSpan.textContent = readTime;
      meta.append(timeSpan);
    }

    content.append(meta);
    metaRow.remove();
  }

  // Title
  if (titleRow) {
    titleRow.className = 'hero-article-heading';
    content.append(titleRow);
  }

  // Subtitle
  if (subtitleRow) {
    subtitleRow.className = 'hero-article-subtitle';
    content.append(subtitleRow);
  }

  block.append(content);
}
