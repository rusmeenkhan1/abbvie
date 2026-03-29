#!/usr/bin/env node
/**
 * Top-to-bottom comparison of first 25 pages against original AbbVie site.
 * Compares every element: headings, paragraphs, links, images, lists, blockquotes, etc.
 * Excludes header, footer, nav, and modal dialogs from originals.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

const files = fs.readdirSync(CONTENT_DIR)
  .filter(f => f.endsWith('.plain.html'))
  .sort()
  .slice(0, 25);

function fetchOriginalHTML(slug) {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  try {
    const html = execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" --max-time 30 "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
    );
    return html;
  } catch (e) {
    return null;
  }
}

function extractArticleContent(html) {
  // Remove header, footer, nav, modals, scripts, styles
  let clean = html
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove modal dialogs
    .replace(/<div[^>]*class="[^"]*modal[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
    .replace(/<div[^>]*id="[^"]*modal[^"]*"[\s\S]*?<\/div>/gi, '')
    // Remove cookie/consent banners
    .replace(/<div[^>]*class="[^"]*cookie[^"]*"[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*consent[^"]*"[\s\S]*?<\/div>/gi, '');

  return clean;
}

// Extract all text-bearing elements from HTML
function extractElements(html) {
  const elements = {
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    paragraphs: [],
    links: [],
    images: [],
    lists: [],
    blockquotes: [],
  };

  // H1-H4
  for (const level of ['h1', 'h2', 'h3', 'h4']) {
    const re = new RegExp(`<${level}[^>]*>([\\s\\S]*?)<\\/${level}>`, 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text) elements[level].push(text);
    }
  }

  // Paragraphs
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRe.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text && text.length > 10) elements.paragraphs.push(text);
  }

  // Links (href + text)
  const aRe = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = aRe.exec(html)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text && !m[1].includes('#') && !m[1].includes('javascript:')) {
      elements.links.push({ href: m[1], text });
    }
  }

  // Images (src + alt)
  const imgRe = /<img[^>]*src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
  while ((m = imgRe.exec(html)) !== null) {
    // Skip tiny icons, tracking pixels, and SVGs
    const src = m[1];
    const alt = m[2] || '';
    if (src.includes('1x1') || src.includes('pixel') || src.includes('.svg') || src.includes('data:image')) continue;
    elements.images.push({ src, alt });
  }

  // Lists
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  while ((m = liRe.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) elements.lists.push(text);
  }

  // Blockquotes
  const bqRe = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
  while ((m = bqRe.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) elements.blockquotes.push(text);
  }

  return elements;
}

function normalizeText(t) {
  return t.toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x26;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareTexts(originals, migrated, label) {
  const issues = [];

  const normOrig = originals.map(normalizeText).filter(t => t.length > 5);
  const normMig = migrated.map(normalizeText).filter(t => t.length > 5);

  // Check for content in original not in migrated
  for (const orig of normOrig) {
    // Skip known exclusions
    if (orig.includes('you are about to leave')) continue;
    if (orig.includes('subscribe to our')) continue;
    if (orig.includes('all stories')) continue;  // Back link text
    if (orig.includes('minute read')) continue;  // Read time
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(orig)) continue; // Dates
    if (orig.includes('share this')) continue;
    if (orig.includes('cookie')) continue;
    if (orig.includes('©')) continue;
    if (orig.includes('privacy')) continue;
    if (orig.includes('terms of use')) continue;
    if (orig.length < 15) continue; // Skip very short text

    const found = normMig.some(m => {
      // Exact match
      if (m === orig) return true;
      // Substring match (for truncated content)
      if (m.includes(orig.substring(0, 50)) || orig.includes(m.substring(0, 50))) return true;
      return false;
    });

    if (!found) {
      issues.push({ type: 'MISSING_IN_MIGRATED', element: label, text: orig.substring(0, 120) });
    }
  }

  return issues;
}

async function comparePage(slug) {
  const issues = [];

  // Read migrated content
  const migratedPath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  const migratedHTML = fs.readFileSync(migratedPath, 'utf8');

  // Fetch original
  const originalHTML = fetchOriginalHTML(slug);
  if (!originalHTML) {
    issues.push({ type: 'FETCH_FAILED', element: 'page', text: 'Could not fetch original page' });
    return issues;
  }

  const articleHTML = extractArticleContent(originalHTML);
  const origElements = extractElements(articleHTML);
  const migElements = extractElements(migratedHTML);

  // Compare H1
  if (origElements.h1.length > 0 && migElements.h1.length === 0) {
    issues.push({ type: 'MISSING_H1', element: 'h1', text: origElements.h1[0].substring(0, 100) });
  } else if (origElements.h1.length > 0 && migElements.h1.length > 0) {
    const origH1 = normalizeText(origElements.h1[0]);
    const migH1 = normalizeText(migElements.h1[0]);
    if (origH1 !== migH1 && !origH1.includes(migH1.substring(0, 30))) {
      issues.push({ type: 'H1_MISMATCH', element: 'h1', text: `Original: "${origH1.substring(0, 60)}" vs Migrated: "${migH1.substring(0, 60)}"` });
    }
  }

  // Compare H2
  issues.push(...compareTexts(origElements.h2, migElements.h2, 'h2'));

  // Compare H3
  issues.push(...compareTexts(origElements.h3, migElements.h3, 'h3'));

  // Compare paragraphs
  issues.push(...compareTexts(origElements.paragraphs, migElements.paragraphs, 'paragraph'));

  // Compare list items
  issues.push(...compareTexts(origElements.lists, migElements.lists, 'list-item'));

  // Compare blockquotes
  issues.push(...compareTexts(origElements.blockquotes, migElements.blockquotes, 'blockquote'));

  // Compare images (count article images excluding icons/logos)
  const origArticleImages = origElements.images.filter(i =>
    i.src.includes('scene7') || i.src.includes('abbvie') || i.alt.length > 5
  );
  const migArticleImages = migElements.images;

  if (origArticleImages.length > migArticleImages.length + 1) {
    issues.push({
      type: 'IMAGE_COUNT_LOW',
      element: 'images',
      text: `Original has ${origArticleImages.length} article images, migrated has ${migArticleImages.length}`
    });
  }

  // Check for broken images in migrated
  const localImgs = [...migratedHTML.matchAll(/src="\.\/(images\/[^"]+)"/g)];
  const existingImages = new Set(fs.readdirSync(IMAGES_DIR));
  for (const m of localImgs) {
    const imgFile = m[1].replace('images/', '');
    if (!existingImages.has(imgFile)) {
      issues.push({ type: 'BROKEN_IMAGE', element: 'image', text: imgFile });
    }
  }

  // Check metadata block completeness
  if (!migratedHTML.includes('class="metadata"')) {
    issues.push({ type: 'MISSING_METADATA', element: 'metadata', text: 'No metadata block' });
  } else {
    if (!migratedHTML.includes('<div>Title</div>')) issues.push({ type: 'MISSING_META_FIELD', element: 'metadata', text: 'Missing Title' });
    if (!migratedHTML.includes('<div>Description</div>')) issues.push({ type: 'MISSING_META_FIELD', element: 'metadata', text: 'Missing Description' });
    if (!migratedHTML.includes('<div>og:title</div>')) issues.push({ type: 'MISSING_META_FIELD', element: 'metadata', text: 'Missing og:title' });
  }

  // Check hero-article block
  if (!migratedHTML.includes('class="hero-article"')) {
    issues.push({ type: 'MISSING_HERO', element: 'hero-article', text: 'No hero-article block' });
  }

  // Check for empty src/href
  if (migratedHTML.match(/src=""/)) issues.push({ type: 'EMPTY_SRC', element: 'image', text: 'Empty image src' });
  if (migratedHTML.match(/<a href="">/)) issues.push({ type: 'EMPTY_HREF', element: 'link', text: 'Empty link href' });

  // Check for icon-search.svg placeholders
  if (migratedHTML.includes('icon-search.svg')) issues.push({ type: 'PLACEHOLDER_IMAGE', element: 'image', text: 'icon-search.svg still present' });

  // Check for external image references
  if (migratedHTML.match(/src="https?:\/\//)) issues.push({ type: 'EXTERNAL_IMAGE', element: 'image', text: 'External image reference' });

  return issues;
}

async function main() {
  console.log(`Top-to-bottom comparison of ${files.length} pages\n`);

  let perfectCount = 0;
  const allIssues = [];

  for (let i = 0; i < files.length; i++) {
    const slug = files[i].replace('.plain.html', '');
    process.stdout.write(`[${i+1}/${files.length}] ${slug}... `);

    const issues = await comparePage(slug);

    if (issues.length === 0) {
      console.log('✓ PERFECT');
      perfectCount++;
    } else {
      console.log(`✗ ${issues.length} issue(s)`);
      issues.forEach(iss => console.log(`    - [${iss.type}] ${iss.element}: ${iss.text}`));
      allIssues.push({ slug, issues });
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${perfectCount}/${files.length} PERFECT`);

  if (allIssues.length > 0) {
    console.log(`\nPages with issues: ${allIssues.length}`);

    // Summary by issue type
    const typeCounts = {};
    for (const page of allIssues) {
      for (const iss of page.issues) {
        typeCounts[iss.type] = (typeCounts[iss.type] || 0) + 1;
      }
    }
    console.log('\nIssue type summary:');
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log(`${'='.repeat(70)}`);
}

main().catch(console.error);
