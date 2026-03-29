#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Top-to-bottom comparison of first 25 pages against original AbbVie site.
 * Compares every element: headings, paragraphs, links, images, lists,
 * blockquotes, etc.
 * Excludes header, footer, nav, and modal dialogs from originals.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(
  __dirname,
  '../../content/who-we-are/our-stories',
);
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'))
  .sort()
  .slice(0, 25);

function fetchOriginalHTML(slug) {
  const base = 'https://www.abbvie.com/who-we-are/our-stories';
  const url = `${base}/${slug}.html`;
  try {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      + ' AppleWebKit/537.36';
    const html = execSync(
      `curl -sL -H "User-Agent: ${ua}" --max-time 30 "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' },
    );
    return html;
  } catch (_e) {
    return null;
  }
}

function extractArticleContent(html) {
  // Remove header, footer, nav, modals, scripts, styles
  const clean = html
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove modal dialogs
    .replace(
      /<div[^>]*class="[^"]*modal[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
      '',
    )
    .replace(
      /<div[^>]*id="[^"]*modal[^"]*"[\s\S]*?<\/div>/gi,
      '',
    )
    // Remove cookie/consent banners
    .replace(
      /<div[^>]*class="[^"]*cookie[^"]*"[\s\S]*?<\/div>/gi,
      '',
    )
    .replace(
      /<div[^>]*class="[^"]*consent[^"]*"[\s\S]*?<\/div>/gi,
      '',
    );

  return clean;
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function execRegex(re, html) {
  const results = [];
  let m = re.exec(html);
  while (m !== null) {
    results.push(m);
    m = re.exec(html);
  }
  return results;
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
  ['h1', 'h2', 'h3', 'h4'].forEach((level) => {
    const re = new RegExp(
      `<${level}[^>]*>([\\s\\S]*?)<\\/${level}>`,
      'gi',
    );
    execRegex(re, html).forEach((match) => {
      const text = stripTags(match[1]);
      if (text) elements[level].push(text);
    });
  });

  // Paragraphs
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  execRegex(pRe, html).forEach((match) => {
    const text = stripTags(match[1]);
    if (text && text.length > 10) elements.paragraphs.push(text);
  });

  // Links (href + text)
  const aRe = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  execRegex(aRe, html).forEach((match) => {
    const text = stripTags(match[2]);
    const href = match[1];
    // eslint-disable-next-line no-script-url
    const isScriptUrl = href.includes('javascript:');
    if (text && !href.includes('#') && !isScriptUrl) {
      elements.links.push({ href, text });
    }
  });

  // Images (src + alt)
  const imgRe = /<img[^>]*src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
  execRegex(imgRe, html).forEach((match) => {
    // Skip tiny icons, tracking pixels, and SVGs
    const src = match[1];
    const alt = match[2] || '';
    const skip = src.includes('1x1')
      || src.includes('pixel')
      || src.includes('.svg')
      || src.includes('data:image');
    if (!skip) {
      elements.images.push({ src, alt });
    }
  });

  // Lists
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  execRegex(liRe, html).forEach((match) => {
    const text = stripTags(match[1]);
    if (text) elements.lists.push(text);
  });

  // Blockquotes
  const bqRe = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
  execRegex(bqRe, html).forEach((match) => {
    const text = stripTags(match[1]);
    if (text) elements.blockquotes.push(text);
  });

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

function isExcludedText(orig) {
  if (orig.includes('you are about to leave')) return true;
  if (orig.includes('subscribe to our')) return true;
  if (orig.includes('all stories')) return true;
  if (orig.includes('minute read')) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(orig)) return true;
  if (orig.includes('share this')) return true;
  if (orig.includes('cookie')) return true;
  if (orig.includes('©')) return true;
  if (orig.includes('privacy')) return true;
  if (orig.includes('terms of use')) return true;
  if (orig.length < 15) return true;
  return false;
}

function compareTexts(originals, migrated, label) {
  const issues = [];

  const normOrig = originals
    .map(normalizeText)
    .filter((t) => t.length > 5);
  const normMig = migrated
    .map(normalizeText)
    .filter((t) => t.length > 5);

  // Check for content in original not in migrated
  normOrig.forEach((orig) => {
    if (isExcludedText(orig)) return;

    const found = normMig.some((m) => {
      // Exact match
      if (m === orig) return true;
      // Substring match (for truncated content)
      if (
        m.includes(orig.substring(0, 50))
        || orig.includes(m.substring(0, 50))
      ) {
        return true;
      }
      return false;
    });

    if (!found) {
      issues.push({
        type: 'MISSING_IN_MIGRATED',
        element: label,
        text: orig.substring(0, 120),
      });
    }
  });

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
    issues.push({
      type: 'FETCH_FAILED',
      element: 'page',
      text: 'Could not fetch original page',
    });
    return issues;
  }

  const articleHTML = extractArticleContent(originalHTML);
  const origElements = extractElements(articleHTML);
  const migElements = extractElements(migratedHTML);

  // Compare H1
  if (origElements.h1.length > 0 && migElements.h1.length === 0) {
    issues.push({
      type: 'MISSING_H1',
      element: 'h1',
      text: origElements.h1[0].substring(0, 100),
    });
  } else if (origElements.h1.length > 0 && migElements.h1.length > 0) {
    const origH1 = normalizeText(origElements.h1[0]);
    const migH1 = normalizeText(migElements.h1[0]);
    if (origH1 !== migH1
      && !origH1.includes(migH1.substring(0, 30))) {
      const origPart = origH1.substring(0, 60);
      const migPart = migH1.substring(0, 60);
      issues.push({
        type: 'H1_MISMATCH',
        element: 'h1',
        text: `Original: "${origPart}" vs Migrated: "${migPart}"`,
      });
    }
  }

  // Compare H2
  issues.push(
    ...compareTexts(origElements.h2, migElements.h2, 'h2'),
  );

  // Compare H3
  issues.push(
    ...compareTexts(origElements.h3, migElements.h3, 'h3'),
  );

  // Compare paragraphs
  issues.push(
    ...compareTexts(
      origElements.paragraphs,
      migElements.paragraphs,
      'paragraph',
    ),
  );

  // Compare list items
  issues.push(
    ...compareTexts(
      origElements.lists,
      migElements.lists,
      'list-item',
    ),
  );

  // Compare blockquotes
  issues.push(
    ...compareTexts(
      origElements.blockquotes,
      migElements.blockquotes,
      'blockquote',
    ),
  );

  // Compare images (count article images excluding icons/logos)
  const origArticleImages = origElements.images.filter(
    (i) => i.src.includes('scene7')
      || i.src.includes('abbvie')
      || i.alt.length > 5,
  );
  const migArticleImages = migElements.images;

  if (origArticleImages.length > migArticleImages.length + 1) {
    issues.push({
      type: 'IMAGE_COUNT_LOW',
      element: 'images',
      text: `Original has ${origArticleImages.length}`
        + ' article images, migrated has'
        + ` ${migArticleImages.length}`,
    });
  }

  // Check for broken images in migrated
  const localImgs = [
    ...migratedHTML.matchAll(/src="\.\/(images\/[^"]+)"/g),
  ];
  const existingImages = new Set(fs.readdirSync(IMAGES_DIR));
  localImgs.forEach((match) => {
    const imgFile = match[1].replace('images/', '');
    if (!existingImages.has(imgFile)) {
      issues.push({
        type: 'BROKEN_IMAGE',
        element: 'image',
        text: imgFile,
      });
    }
  });

  // Check metadata block completeness
  if (!migratedHTML.includes('class="metadata"')) {
    issues.push({
      type: 'MISSING_METADATA',
      element: 'metadata',
      text: 'No metadata block',
    });
  } else {
    if (!migratedHTML.includes('<div>Title</div>')) {
      issues.push({
        type: 'MISSING_META_FIELD',
        element: 'metadata',
        text: 'Missing Title',
      });
    }
    if (!migratedHTML.includes('<div>Description</div>')) {
      issues.push({
        type: 'MISSING_META_FIELD',
        element: 'metadata',
        text: 'Missing Description',
      });
    }
    if (!migratedHTML.includes('<div>og:title</div>')) {
      issues.push({
        type: 'MISSING_META_FIELD',
        element: 'metadata',
        text: 'Missing og:title',
      });
    }
  }

  // Check hero-article block
  if (!migratedHTML.includes('class="hero-article"')) {
    issues.push({
      type: 'MISSING_HERO',
      element: 'hero-article',
      text: 'No hero-article block',
    });
  }

  // Check for empty src/href
  if (migratedHTML.match(/src=""/)) {
    issues.push({
      type: 'EMPTY_SRC',
      element: 'image',
      text: 'Empty image src',
    });
  }
  if (migratedHTML.match(/<a href="">/)) {
    issues.push({
      type: 'EMPTY_HREF',
      element: 'link',
      text: 'Empty link href',
    });
  }

  // Check for icon-search.svg placeholders
  if (migratedHTML.includes('icon-search.svg')) {
    issues.push({
      type: 'PLACEHOLDER_IMAGE',
      element: 'image',
      text: 'icon-search.svg still present',
    });
  }

  // Check for external image references
  if (migratedHTML.match(/src="https?:\/\//)) {
    issues.push({
      type: 'EXTERNAL_IMAGE',
      element: 'image',
      text: 'External image reference',
    });
  }

  return issues;
}

async function main() {
  console.log(`Top-to-bottom comparison of ${files.length} pages\n`);

  let perfectCount = 0;
  const allIssues = [];

  for (let i = 0; i < files.length; i += 1) {
    const slug = files[i].replace('.plain.html', '');
    process.stdout.write(`[${i + 1}/${files.length}] ${slug}... `);

    // eslint-disable-next-line no-await-in-loop
    const issues = await comparePage(slug);

    if (issues.length === 0) {
      console.log('PERFECT');
      perfectCount += 1;
    } else {
      console.log(`${issues.length} issue(s)`);
      issues.forEach((iss) => {
        console.log(`    - [${iss.type}] ${iss.element}: ${iss.text}`);
      });
      allIssues.push({ slug, issues });
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${perfectCount}/${files.length} PERFECT`);

  if (allIssues.length > 0) {
    console.log(`\nPages with issues: ${allIssues.length}`);

    // Summary by issue type
    const typeCounts = {};
    allIssues.forEach((page) => {
      page.issues.forEach((iss) => {
        typeCounts[iss.type] = (typeCounts[iss.type] || 0) + 1;
      });
    });
    console.log('\nIssue type summary:');
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
  }
  console.log(`${'='.repeat(70)}`);
}

main().catch(console.error);
