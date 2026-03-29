#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Final deep check of first 25 pages.
 * Extracts all article body text from originals (excluding header/footer/hero metadata/modals)
 * and verifies every significant paragraph exists in our migrated pages.
 * Also checks links, images, and heading structure.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');
const existingImages = new Set(fs.readdirSync(IMAGES_DIR));

const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'))
  .sort()
  .slice(0, 25);

function fetchOriginalHTML(slug) {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  try {
    return execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" --max-time 30 "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' },
    );
  } catch (_e) {
    return null;
  }
}

function normalizeText(t) {
  return t.toLowerCase()
    .replace(/['\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x26;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract article body content from original (excluding hero metadata, header, footer, modals)
function extractOrigBodyContent(html) {
  // Try to find the main article content area
  let articleHTML = html;

  // Remove everything before the article
  const articleStart = html.match(
    /<article|<main|class="article-body"|class="content-body"|class="story-content"/i,
  );
  if (articleStart) {
    articleHTML = html.substring(articleStart.index);
  }

  // Remove header, footer, nav, scripts, styles, modals
  articleHTML = articleHTML
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  return articleHTML;
}

// Skip patterns for non-article content
const SKIP_PATTERNS = [
  'you are about to leave',
  'subscribe to our',
  'unless otherwise specified, all product names',
  'cookie',
  '\u00A9',
  '[emailprotected]',
  '[email protected]',
  'media inquir',
];

function shouldSkipParagraph(text) {
  if (text.length < 30) return true;
  if (SKIP_PATTERNS.some((pat) => text.includes(pat))) return true;
  if (/^\w+ \d{1,2}, \d{4}/.test(text)) return true;
  return false;
}

// Get all meaningful paragraphs from original article body (>30 chars, not metadata)
function getOrigParagraphs(html) {
  const paragraphs = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m = pRe.exec(html);
  while (m !== null) {
    const text = normalizeText(m[1].replace(/<[^>]+>/g, ''));
    if (!shouldSkipParagraph(text)) {
      paragraphs.push(text);
    }
    m = pRe.exec(html);
  }
  return paragraphs;
}

// Get migrated page text (all text including hero subtitle and body)
function getMigratedText(html) {
  return normalizeText(html.replace(/<[^>]+>/g, ' '));
}

// Get all H2/H3 headings from original
function getOrigHeadings(html) {
  const headings = [];
  const re = /<(h[23])[^>]*>([\s\S]*?)<\/\1>/gi;
  let m = re.exec(html);
  while (m !== null) {
    const text = normalizeText(m[2].replace(/<[^>]+>/g, ''));
    if (text.length > 3
        && !text.includes('you are about to leave')
        && !text.includes('share this')) {
      headings.push({ level: m[1], text });
    }
    m = re.exec(html);
  }
  return headings;
}

function getMigratedHeadings(html) {
  const headings = [];
  const re = /<(h[234])[^>]*>([\s\S]*?)<\/\1>/gi;
  let m = re.exec(html);
  while (m !== null) {
    const text = normalizeText(m[2].replace(/<[^>]+>/g, ''));
    if (text.length > 3) headings.push({ level: m[1], text });
    m = re.exec(html);
  }
  return headings;
}

async function checkPage(slug) {
  const issues = [];
  const migratedPath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  const migratedHTML = fs.readFileSync(migratedPath, 'utf8');
  const migratedFullText = getMigratedText(migratedHTML);

  const originalHTML = fetchOriginalHTML(slug);
  if (!originalHTML) {
    return [{ type: 'FETCH_FAILED', detail: 'Could not fetch original' }];
  }

  const articleHTML = extractOrigBodyContent(originalHTML);

  // 1. Check body paragraphs - use substring matching in full migrated text
  const origParas = getOrigParagraphs(articleHTML);
  origParas.forEach((para) => {
    // Check first 50 chars (handles truncation, different punctuation, etc.)
    const searchChunk = para
      .substring(0, Math.min(50, para.length))
      .replace(/['"]/g, '');
    if (!migratedFullText.replace(/['"]/g, '').includes(searchChunk)) {
      issues.push({
        type: 'MISSING_PARAGRAPH',
        detail: para.substring(0, 120),
      });
    }
  });

  // 2. Check headings
  const origHeadings = getOrigHeadings(articleHTML);
  const migHeadings = getMigratedHeadings(migratedHTML);
  const migHeadingTexts = migHeadings.map(
    (h) => h.text.replace(/['"]/g, ''),
  );

  origHeadings.forEach((h) => {
    const searchText = h.text
      .substring(0, Math.min(40, h.text.length))
      .replace(/['"]/g, '');
    const found = migHeadingTexts.some((mt) => mt.includes(searchText));
    if (!found) {
      issues.push({
        type: 'MISSING_HEADING',
        detail: `${h.level}: ${h.text.substring(0, 80)}`,
      });
    }
  });

  // 3. Check article images exist locally
  const localImgs = [...migratedHTML.matchAll(
    /src="\.\/(images\/[^"]+)"/g,
  )];
  localImgs.forEach((match) => {
    const imgFile = match[1].replace('images/', '');
    if (!existingImages.has(imgFile)) {
      issues.push({ type: 'BROKEN_IMAGE', detail: imgFile });
    }
  });

  // 4. Check structural requirements
  if (!migratedHTML.includes('class="hero-article"')) {
    issues.push({
      type: 'MISSING_HERO_BLOCK',
      detail: 'No hero-article block',
    });
  } else {
    const hero = migratedHTML.match(
      /class="hero-article">([\s\S]*?)(?=<\/div>\s*<div>|<\/div>\s*<div class)/,
    );
    if (hero) {
      if (!hero[1].includes('<img')) {
        issues.push({
          type: 'HERO_NO_IMAGE',
          detail: 'Hero missing image',
        });
      }
      if (!hero[1].includes('<h1')) {
        issues.push({
          type: 'HERO_NO_H1',
          detail: 'Hero missing H1',
        });
      }
    }
  }

  if (!migratedHTML.includes('class="metadata"')) {
    issues.push({
      type: 'MISSING_METADATA',
      detail: 'No metadata block',
    });
  } else {
    if (!migratedHTML.includes('<div>Title</div>')) {
      issues.push({
        type: 'META_NO_TITLE',
        detail: 'Missing Title field',
      });
    }
    if (!migratedHTML.includes('<div>Description</div>')) {
      issues.push({
        type: 'META_NO_DESC',
        detail: 'Missing Description field',
      });
    }
    if (!migratedHTML.includes('<div>og:title</div>')) {
      issues.push({
        type: 'META_NO_OG',
        detail: 'Missing og:title field',
      });
    }
  }

  // 5. Structural integrity
  if (migratedHTML.match(/src=""/)) {
    issues.push({
      type: 'EMPTY_SRC',
      detail: 'Empty image src attribute',
    });
  }
  if (migratedHTML.match(/<a href="">/)) {
    issues.push({
      type: 'EMPTY_HREF',
      detail: 'Empty link href',
    });
  }
  if (migratedHTML.includes('icon-search.svg')) {
    issues.push({
      type: 'PLACEHOLDER_IMG',
      detail: 'icon-search.svg still present',
    });
  }
  if (migratedHTML.match(/src="https?:\/\//)) {
    issues.push({
      type: 'EXTERNAL_IMG',
      detail: 'External image reference',
    });
  }

  const h1Count = (migratedHTML.match(/<h1[^>]*>/g) || []).length;
  if (h1Count !== 1) {
    issues.push({
      type: 'H1_COUNT',
      detail: `Expected 1 H1, found ${h1Count}`,
    });
  }

  return issues;
}

async function main() {
  console.log(`Deep content check of ${files.length} pages against originals\n`);

  let perfectCount = 0;
  const allIssues = [];

  for (let i = 0; i < files.length; i += 1) {
    const slug = files[i].replace('.plain.html', '');
    process.stdout.write(`[${i + 1}/${files.length}] ${slug}... `);

    // eslint-disable-next-line no-await-in-loop
    const issues = await checkPage(slug);

    if (issues.length === 0) {
      console.log('PERFECT');
      perfectCount += 1;
    } else {
      console.log(`${issues.length} issue(s)`);
      issues.forEach((iss) => console.log(`    [${iss.type}] ${iss.detail}`));
      allIssues.push({ slug, issues });
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${perfectCount}/${files.length} PERFECT`);

  if (allIssues.length > 0) {
    console.log(`\nPages with real issues: ${allIssues.length}`);
    const typeCounts = {};
    allIssues.forEach((p) => {
      p.issues.forEach((iss) => {
        typeCounts[iss.type] = (typeCounts[iss.type] || 0) + 1;
      });
    });
    console.log('\nIssue summary:');
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
  }
  console.log(`${'='.repeat(70)}`);
}

main().catch(console.error);
