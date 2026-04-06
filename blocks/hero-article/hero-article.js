async function getLastModifiedDate() {
  const { pathname } = window.location;
  const pagePath = pathname.replace(/\.html$/, '');
  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) return null;
    const json = await resp.json();
    const entry = json.data.find((item) => item.path === pagePath);
    if (!entry?.lastModified) return null;
    const date = new Date(entry.lastModified * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

export default async function decorate(block) {
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

    // Handle both 2-column (category | readTime) and 3-column (date | category | readTime)
    const colTexts = cols.map((c) => c.textContent?.trim()).filter(Boolean);
    const readTimePattern = /\d+\s*minute\s*read/i;
    const readTimeVal = colTexts.find((t) => readTimePattern.test(t));
    const nonReadTime = colTexts.filter((t) => !readTimePattern.test(t));

    // First non-readtime value is category
    const category = nonReadTime[0];

    // Fetch lastModified date from query-index.json and prepend to meta
    const dateStr = await getLastModifiedDate();
    if (dateStr) {
      const dateSpan = document.createElement('span');
      dateSpan.className = 'hero-article-date';
      dateSpan.textContent = dateStr;
      meta.append(dateSpan);
    }

    if (category) {
      const catSpan = document.createElement('span');
      catSpan.className = 'hero-article-category';
      catSpan.textContent = category;
      meta.append(catSpan);
    }
    if (readTimeVal) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'hero-article-readtime';
      timeSpan.textContent = readTimeVal;
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
