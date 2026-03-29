#!/usr/bin/env node
/**
 * Detailed image comparison for selected pages.
 * Shows exactly which images are in the original vs migrated content.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');

// Test with 5 representative pages
const TEST_SLUGS = [
  '5-ways-abbvie-work-to-deliver-medicines-in-half-the-time',
  'connecting-patients-with-care-3-lessons-learned-during-covid-19',
  'chasing-the-value-of-a-walk-down-the-aisle',
  'can-unlocking-one-million-genomes',
  'a-legacy-of-leadership-in-mental-health',
];

function fetchOriginal(slug) {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  try {
    return execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 "${url}"`,
      { maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' }
    );
  } catch (e) {
    return null;
  }
}

function extractAllImages(html, label) {
  // Strip header and footer
  let body = html;
  const headerEnd = html.indexOf('</header>');
  if (headerEnd > -1) body = html.substring(headerEnd + 9);
  const footerStart = body.search(/<footer/i);
  if (footerStart > -1) body = body.substring(0, footerStart);

  const images = [];

  // src images
  const srcMatches = [...body.matchAll(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  for (const m of srcMatches) {
    const src = m[1];
    const altMatch = m[0].match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    images.push({ src: src.substring(0, 120), alt: alt.substring(0, 60) });
  }

  // data-src (lazy loaded)
  const dataSrcMatches = [...body.matchAll(/<img[^>]*\bdata-src=["']([^"']+)["'][^>]*>/gi)];
  for (const m of dataSrcMatches) {
    const src = m[1];
    const altMatch = m[0].match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    if (!images.find(i => i.src === src.substring(0, 120))) {
      images.push({ src: src.substring(0, 120) + ' [data-src]', alt: alt.substring(0, 60) });
    }
  }

  return images;
}

function extractMigratedImages(html) {
  const images = [];
  const srcMatches = [...html.matchAll(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  for (const m of srcMatches) {
    const src = m[1];
    const altMatch = m[0].match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    images.push({ src: src.substring(0, 120), alt: alt.substring(0, 60) });
  }
  return images;
}

for (const slug of TEST_SLUGS) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`PAGE: ${slug}`);
  console.log(`${'='.repeat(80)}`);

  const originalHtml = fetchOriginal(slug);
  if (!originalHtml) {
    console.log('  FETCH FAILED');
    continue;
  }

  const migratedHtml = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.plain.html`), 'utf8');

  const origImages = extractAllImages(originalHtml, 'ORIGINAL');
  const migrImages = extractMigratedImages(migratedHtml);

  console.log(`\nORIGINAL BODY IMAGES (${origImages.length}):`);
  origImages.forEach((img, i) => {
    // Categorize
    const src = img.src.toLowerCase();
    let category = 'ARTICLE';
    if (src.includes('/is/image/') || src.includes('/is/content/')) category = 'SCENE7';
    if (src.includes('/content/dam/')) category = 'DAM';
    if (src.includes('svg+xml') || src.includes('data:image')) category = 'INLINE';
    if (src.includes('/navigation/') || src.includes('mega-menu')) category = 'NAV';
    if (src.includes('/icons/') || src.includes('icon')) category = 'ICON';
    console.log(`  ${i + 1}. [${category}] alt="${img.alt}" | ${img.src}`);
  });

  console.log(`\nMIGRATED IMAGES (${migrImages.length}):`);
  migrImages.forEach((img, i) => {
    console.log(`  ${i + 1}. alt="${img.alt}" | ${img.src}`);
  });

  console.log(`\nDIFF: ${origImages.length - migrImages.length} more images in original`);
}
