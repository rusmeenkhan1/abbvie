#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Accurate content check for first 25 pages.
 * Uses direct substring matching with proper normalization.
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
  try {
    return execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" --max-time 30 "https://www.abbvie.com/who-we-are/our-stories/${slug}.html"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' },
    );
  } catch (e) {
    return null;
  }
}

function normalize(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/[''ʼ]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
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

// Known non-article text patterns to skip
const SKIP_PATTERNS = [
  'you are about to leave',
  'product-specific site internet site',
  'subscribe to our',
  'unless otherwise specified, all product names',
  '[emailprotected]', '[email protected]',
  'media inquir',
  'cookie preference',
  '© 20',
  'terms of use',
  'privacy notice',
  'all rights reserved',
  'accessibility statement',
  'partner with us',
  'patient support',
  'contract manufacturing',
  'medical information',
  'sitemap',
];

function shouldSkip(text) {
  return SKIP_PATTERNS.some((p) => text.includes(p));
}

function getOrigArticleParagraphs(html) {
  const clean = html
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  const paragraphs = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m = pRe.exec(clean);
  while (m !== null) {
    const text = normalize(m[1]);
    if (
      text.length >= 40
      && !shouldSkip(text)
      && !/^\w+ \d{1,2}, \d{4}\s+\w+$/.test(text)
    ) {
      paragraphs.push(text);
    }
    m = pRe.exec(clean);
  }
  return paragraphs;
}

function getOrigHeadings(html) {
  const clean = html
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '');
  const headings = [];
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  let m = re.exec(clean);
  while (m !== null) {
    const text = normalize(m[1]);
    if (
      text.length > 5
      && !text.includes('you are about to leave')
      && !text.includes('share this')
    ) {
      headings.push(text);
    }
    m = re.exec(clean);
  }
  return headings;
}

function checkPage(slug) {
  const issues = [];
  const migratedPath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  const migratedHTML = fs.readFileSync(migratedPath, 'utf8');
  const migratedPlain = normalize(migratedHTML);

  const originalHTML = fetchOriginalHTML(slug);
  if (!originalHTML) {
    return [{ type: 'FETCH_FAILED', detail: 'Could not fetch original' }];
  }

  // 1. PARAGRAPH CHECK - direct substring in normalized text
  const origParas = getOrigArticleParagraphs(originalHTML);
  origParas.forEach((para) => {
    // Take a 40-char chunk from the middle of the paragraph
    const start = Math.min(10, Math.floor(para.length / 4));
    const chunk = para.substring(start, start + 40);
    if (chunk.length >= 20 && !migratedPlain.includes(chunk)) {
      issues.push({
        type: 'MISSING_PARAGRAPH',
        detail: para.substring(0, 120),
      });
    }
  });

  // 2. HEADING CHECK
  const origHeadings = getOrigHeadings(originalHTML);
  origHeadings.forEach((h) => {
    const chunk = h.substring(0, Math.min(30, h.length));
    if (chunk.length >= 5 && !migratedPlain.includes(chunk)) {
      issues.push({
        type: 'MISSING_HEADING',
        detail: h.substring(0, 80),
      });
    }
  });

  // 3. STRUCTURAL CHECKS
  if (!migratedHTML.includes('class="hero-article"')) {
    issues.push({ type: 'NO_HERO', detail: 'Missing hero-article block' });
  }
  if (!migratedHTML.includes('class="metadata"')) {
    issues.push({ type: 'NO_METADATA', detail: 'Missing metadata block' });
  } else {
    if (!migratedHTML.includes('<div>Title</div>')) {
      issues.push({ type: 'META', detail: 'Missing Title' });
    }
    if (!migratedHTML.includes('<div>Description</div>')) {
      issues.push({ type: 'META', detail: 'Missing Description' });
    }
    if (!migratedHTML.includes('<div>og:title</div>')) {
      issues.push({ type: 'META', detail: 'Missing og:title' });
    }
  }

  // 4. IMAGE INTEGRITY
  const localImgs = [...migratedHTML.matchAll(/src="\.\/(images\/[^"]+)"/g)];
  localImgs.forEach((match) => {
    const imgFile = match[1].replace('images/', '');
    if (!existingImages.has(imgFile)) {
      issues.push({ type: 'BROKEN_IMG', detail: imgFile });
    }
  });
  if (migratedHTML.match(/src=""/)) {
    issues.push({ type: 'EMPTY_SRC', detail: 'Empty image src' });
  }
  if (migratedHTML.match(/<a href="">/)) {
    issues.push({ type: 'EMPTY_HREF', detail: 'Empty link href' });
  }
  if (migratedHTML.includes('icon-search.svg')) {
    issues.push({ type: 'PLACEHOLDER', detail: 'icon-search.svg' });
  }
  if (migratedHTML.match(/src="https?:\/\//)) {
    issues.push({ type: 'EXTERNAL_IMG', detail: 'External image URL' });
  }

  // 5. SINGLE H1
  const h1Count = (migratedHTML.match(/<h1[^>]*>/g) || []).length;
  if (h1Count !== 1) {
    issues.push({ type: 'H1_COUNT', detail: `Found ${h1Count} H1s` });
  }

  return issues;
}

async function main() {
  console.log(`Accurate content check: ${files.length} pages\n`);

  let passCount = 0;
  const allIssues = [];

  for (let i = 0; i < files.length; i += 1) {
    const slug = files[i].replace('.plain.html', '');
    process.stdout.write(`[${i + 1}/${files.length}] ${slug}... `);
    const issues = checkPage(slug);

    if (issues.length === 0) {
      console.log('✓');
      passCount += 1;
    } else {
      console.log(`✗ (${issues.length})`);
      issues.forEach((iss) => console.log(`    [${iss.type}] ${iss.detail}`));
      allIssues.push({ slug, issues });
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${passCount}/${files.length} PASSED`);
  if (allIssues.length > 0) {
    console.log(`FAILED: ${allIssues.length}`);
    const typeCounts = {};
    allIssues.forEach((p) => {
      p.issues.forEach((iss) => {
        typeCounts[iss.type] = (typeCounts[iss.type] || 0) + 1;
      });
    });
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
  }
  console.log(`${'='.repeat(70)}`);
}

main().catch(console.error);
