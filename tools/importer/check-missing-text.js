#!/usr/bin/env node
/**
 * Check what body text paragraphs are actually missing from migrated pages.
 * Filters out hero subtitle, metadata, and navigation content.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');

// Check 5 representative pages
const SLUGS = [
  '5-ways-abbvie-work-to-deliver-medicines-in-half-the-time',
  'connecting-patients-with-care-3-lessons-learned-during-covid-19',
  'abbvie-volunteers-return-to-serving',
  'a-legacy-of-leadership-in-mental-health',
  'btk-protein-good-bad-and-ugly',
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

function normalizeText(text) {
  return text
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/&#x26;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

for (const slug of SLUGS) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`PAGE: ${slug}`);
  console.log(`${'='.repeat(80)}`);

  const originalHtml = fetchOriginal(slug);
  if (!originalHtml) {
    console.log('  FETCH FAILED');
    continue;
  }

  const migratedHtml = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.plain.html`), 'utf8');

  // Extract original body - between </header> and footer
  let body = originalHtml;
  const headerEnd = originalHtml.indexOf('</header>');
  if (headerEnd > -1) body = originalHtml.substring(headerEnd + 9);
  const footerStart = body.search(/<footer/i);
  if (footerStart > -1) body = body.substring(0, footerStart);

  // Remove experience fragments (additional footer content)
  body = body.replace(/<div[^>]*class="experiencefragment[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Extract paragraphs from body
  const origParas = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(t => t.length > 30);

  // Extract paragraphs from migrated
  const migrParas = [...migratedHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(t => t.length > 30);

  const migrNorm = migrParas.map(normalizeText);

  // Find missing
  const missing = [];
  for (const op of origParas) {
    const normO = normalizeText(op);
    const found = migrNorm.some(mn => {
      if (mn === normO) return true;
      if (normO.length > 40 && mn.includes(normO.substring(0, 40))) return true;
      if (mn.length > 40 && normO.includes(mn.substring(0, 40))) return true;
      return false;
    });
    if (!found) {
      missing.push(op);
    }
  }

  console.log(`\nOriginal body paragraphs: ${origParas.length}`);
  console.log(`Migrated body paragraphs: ${migrParas.length}`);
  console.log(`Missing paragraphs: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\nMISSING PARAGRAPHS:');
    for (const m of missing) {
      // Truncate and show
      const short = m.length > 120 ? m.substring(0, 120) + '...' : m;
      console.log(`  - "${short}"`);
    }
  }
}
