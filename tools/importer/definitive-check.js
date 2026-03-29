#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Definitive accuracy check for first 25 pages.
 * Compares body text content from original pages against migrated pages,
 * properly handling HTML tag boundaries, Cloudflare email obfuscation,
 * and correctly excluding header/footer/modal content.
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

function normalizeForSearch(text) {
  return text.toLowerCase()
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .replace(/[''ʼ]/g, "'") // normalize apostrophes
    .replace(/[""]/g, '"') // normalize quotes
    .replace(/[–—]/g, '-') // normalize dashes
    .replace(/\u00a0/g, ' ') // non-breaking space
    .replace(/&amp;/g, '&')
    .replace(/&#x26;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

function isExcludedParagraph(text) {
  if (text.length < 40) return true;
  if (text.includes('you are about to leave')) return true;
  if (text.includes('product-specific site internet site')) return true;
  if (text.includes('subscribe to our')) return true;
  if (text.includes('unless otherwise specified, all product names')) return true;
  if (text.includes('[emailprotected]') || text.includes('[email protected]')) return true;
  if (text.includes('media inquir')) return true;
  if (text.includes('cookie')) return true;
  if (text.includes('©')) return true;
  if (text.includes('terms of use')) return true;
  if (text.includes('privacy notice')) return true;
  if (/^\w+ \d{1,2}, \d{4}\s+\w+$/.test(text)) return true;
  return false;
}

// Extract only article body paragraphs from original HTML, excluding non-content areas
function getOrigArticleParagraphs(html) {
  // Find content between article markers, excluding header/footer/nav/modal
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
    const text = normalizeForSearch(m[1]);
    if (!isExcludedParagraph(text)) {
      paragraphs.push(text);
    }
    m = pRe.exec(clean);
  }
  return paragraphs;
}

function checkPage(slug) {
  const issues = [];
  const migratedPath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  const migratedHTML = fs.readFileSync(migratedPath, 'utf8');
  const migratedSearchable = normalizeForSearch(migratedHTML);

  const originalHTML = fetchOriginalHTML(slug);
  if (!originalHTML) {
    return [{ type: 'FETCH_FAILED', detail: 'Could not fetch original' }];
  }

  // 1. CONTENT CHECK: Every body paragraph from original should exist in migrated
  const origParas = getOrigArticleParagraphs(originalHTML);
  origParas.forEach((para) => {
    // Use a generous word-based search: take first 6 significant words
    const words = para.split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
    if (words.length >= 3) {
      const searchPhrase = words.join(' ').replace(/[^\w\s]/g, '');

      // Search in migrated text with fuzzy matching
      const migratedWords = migratedSearchable.replace(/[^\w\s]/g, '');
      if (!migratedWords.includes(searchPhrase)) {
        // Try even shorter phrase
        const shortPhrase = words.slice(0, 4).join(' ');
        if (!migratedWords.includes(shortPhrase)) {
          issues.push({
            type: 'MISSING_CONTENT',
            detail: para.substring(0, 120),
          });
        }
      }
    }
  });

  // 2. HEADING CHECK: All H2/H3 headings from original
  const origH2s = [];
  const hRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  const origClean = originalHTML
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '');
  let hm = hRe.exec(origClean);
  while (hm !== null) {
    const text = normalizeForSearch(hm[1]);
    if (text.length > 5
      && !text.includes('you are about to leave')
      && !text.includes('share this')) {
      origH2s.push(text);
    }
    hm = hRe.exec(origClean);
  }
  const migHeadingText = migratedSearchable;
  origH2s.forEach((h) => {
    const words = h.split(/\s+/).filter((w) => w.length > 2).slice(0, 4);
    const searchPhrase = words.join(' ').replace(/[^\w\s]/g, '');
    if (searchPhrase.length > 5
      && !migHeadingText.replace(/[^\w\s]/g, '').includes(searchPhrase)) {
      issues.push({ type: 'MISSING_HEADING', detail: h.substring(0, 80) });
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
      issues.push({ type: 'META_FIELD', detail: 'Missing Title' });
    }
    if (!migratedHTML.includes('<div>Description</div>')) {
      issues.push({ type: 'META_FIELD', detail: 'Missing Description' });
    }
    if (!migratedHTML.includes('<div>og:title</div>')) {
      issues.push({ type: 'META_FIELD', detail: 'Missing og:title' });
    }
  }

  // 4. IMAGE INTEGRITY
  const localImgs = [...migratedHTML.matchAll(/src="\.\/(images\/[^"]+)"/g)];
  localImgs.forEach((img) => {
    const imgFile = img[1].replace('images/', '');
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

  // 5. H1 COUNT
  const h1Count = (migratedHTML.match(/<h1[^>]*>/g) || []).length;
  if (h1Count !== 1) {
    issues.push({
      type: 'H1_COUNT',
      detail: `Found ${h1Count} H1s, expected 1`,
    });
  }

  return issues;
}

async function main() {
  console.log(`Definitive content check: ${files.length} pages\n`);

  let passCount = 0;
  const allIssues = [];

  for (let i = 0; i < files.length; i += 1) {
    const slug = files[i].replace('.plain.html', '');
    process.stdout.write(`[${i + 1}/${files.length}] ${slug}... `);
    const issues = checkPage(slug);

    if (issues.length === 0) {
      console.log('PASS');
      passCount += 1;
    } else {
      console.log(`FAIL (${issues.length})`);
      issues.forEach((iss) => console.log(`    [${iss.type}] ${iss.detail}`));
      allIssues.push({ slug, issues });
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`DEFINITIVE RESULTS: ${passCount}/${files.length} PASSED`);
  if (allIssues.length > 0) {
    console.log(`FAILED: ${allIssues.length} pages`);
    const typeCounts = {};
    allIssues.forEach((p) => {
      p.issues.forEach((iss) => {
        typeCounts[iss.type] = (typeCounts[iss.type] || 0) + 1;
      });
    });
    console.log('\nBreakdown:');
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
  }
  console.log(`${'='.repeat(70)}`);
}

main().catch(console.error);
