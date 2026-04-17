/**
 * Fetches the query index and injects the published date into hero-article blocks.
 * Matches the current page path against the index to find the corresponding date.
 * @param {Element} main The main element
 */
async function addArticleDate(main) {
  const meta = main.querySelector('.hero-article .hero-article-meta');
  if (!meta) return;

  // Skip if a date element already exists
  if (meta.querySelector('.hero-article-date')) return;

  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) return;
    const { data } = await resp.json();
    if (!data) return;

    let { pathname } = window.location;
    if (pathname.endsWith('.html')) pathname = pathname.slice(0, -5);
    if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);

    const entry = data.find((e) => e.path === pathname);
    if (!entry?.['last-Modified']) return;

    const date = new Date(entry['last-Modified'] * 1000);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const dateDiv = document.createElement('div');
    dateDiv.className = 'hero-article-date';
    dateDiv.textContent = formatted;

    // Insert as first child in meta (date appears above category and read time)
    meta.prepend(dateDiv);
  } catch {
    // silently fail — date is non-critical
  }
}

/**
 * Decorates the stories-article template.
 * @param {Element} main The main element
 */
export default async function decorate(main) {
  addArticleDate(main);
}
