#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Deep comparison of migrated pages vs original AbbVie pages.
 * Compares: headings, paragraphs, images (src+alt), links (href+text),
 * lists, block quotes, metadata, and overall text content.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const REPORT_DIR = path.resolve(__dirname, '../../migration-work/page-reports');

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

// Slugs to compare
const SLUGS = [
  '5-ways-abbvie-work-to-deliver-medicines-in-half-the-time',
  'a-journey-of-sight-progress',
  'a-legacy-of-leadership-in-mental-health',
  'a-molecular-behavior-chart-speeding-up-research-with-predictive-analytics',
  'abbvie-rebuilds-north-chicagos-middle-school-inspiring-students-to-reach-higher',
  'abbvie-research-collaborative',
  'abbvie-volunteers-return-to-serving',
  'abbvies-2024-working-parents-finding-purpose-in-adversity',
  'advancing-a-public-health-approach-to-patient-safety',
  'advice-from-scientist-turned-physician-turned-robot-builder-be-curious',
  'ambassadors-in-action',
  'an-innovative-approach-to-improve-maternal-health',
  'breaking-the-rules-of-science-to-treat-cancer',
  'btk-protein-good-bad-and-ugly',
  'can-unlocking-one-million-genomes',
  'celebrating-abbvies-2025-working-parents-caregivers',
  'change-from-within',
  'chasing-the-value-of-a-walk-down-the-aisle',
  'chembeads-improving-artificial-intelligence-through-human-ingenuity',
  'childhood-cancer-patients-and-their-families-find-a-home-away-from-home',
  'connecting-patients-with-care-3-lessons-learned-during-covid-19',
  'day-in-life-government-affairs-director-educates-and-empowers',
  'day-in-life-meet-director-clearing-path-for-patient-access',
  'day-in-life-meet-engineer-promoting-diversity-within-manufacturing',
  'day-in-the-life-creating-impact-with-nonprofit-partners',
];

function fetchOriginal(slug) {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  try {
    return execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" --max-time 30 "${url}"`,
      { maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' },
    );
  } catch (_e) {
    return null;
  }
}

// Extract text between article/main content, ignoring header/footer
function extractBodyContent(html) {
  let body = html;

  // Remove header
  const headerEnd = html.indexOf('</header>');
  if (headerEnd > -1) body = html.substring(headerEnd);

  // Remove footer
  const footerStart = body.lastIndexOf('<footer');
  if (footerStart > -1) body = body.substring(0, footerStart);

  // Also remove experience fragments (header/footer)
  body = body.replace(
    /<div[^>]*class="experiencefragment[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    '',
  );

  return body;
}

// Extract structured elements from HTML
function extractElements(html) {
  const elements = {
    headings: [],
    paragraphs: [],
    images: [],
    links: [],
    lists: [],
    meta: {},
  };

  // Headings
  const headingMatches = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  headingMatches.forEach((m) => {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text) elements.headings.push({ level: parseInt(m[1], 10), text });
  });

  // Paragraphs (text content only)
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  pMatches.forEach((m) => {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text && text.length > 10) elements.paragraphs.push(text);
  });

  // Images
  const imgMatches = [...html.matchAll(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  imgMatches.forEach((m) => {
    const altMatch = m[0].match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    elements.images.push({ src: m[1], alt });
  });

  // Also check for data-src lazy-loaded images
  const lazySrcMatches = [
    ...html.matchAll(/<img[^>]*\bdata-src=["']([^"']+)["'][^>]*>/gi),
  ];
  lazySrcMatches.forEach((m) => {
    const altMatch = m[0].match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    // Only add if not already captured via src
    const src = m[1];
    if (!elements.images.find((img) => img.src === src)) {
      elements.images.push({ src, alt });
    }
  });

  // Links (non-navigation)
  const linkMatches = [
    ...html.matchAll(/<a[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ];
  linkMatches.forEach((m) => {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    const href = m[1];
    // Skip navigation/header/footer links and javascript: URLs
    const isJSUrl = href.startsWith('javascript'); // eslint-disable-line no-script-url
    if (text && href && !href.startsWith('#') && !isJSUrl) {
      elements.links.push({ href, text });
    }
  });

  // Meta tags
  const metaDescMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
  ) || html.match(
    /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i,
  );
  if (metaDescMatch) {
    [, elements.meta.description] = metaDescMatch;
  }

  const ogTitleMatch = html.match(
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
  ) || html.match(
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i,
  );
  if (ogTitleMatch) {
    [, elements.meta.ogTitle] = ogTitleMatch;
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    [, elements.meta.title] = titleMatch;
  }

  return elements;
}

function extractMigratedElements(html) {
  const elements = {
    headings: [],
    paragraphs: [],
    images: [],
    links: [],
    meta: {},
  };

  // Headings
  const headingMatches = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  headingMatches.forEach((m) => {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text) elements.headings.push({ level: parseInt(m[1], 10), text });
  });

  // Paragraphs
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  pMatches.forEach((m) => {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text && text.length > 10) elements.paragraphs.push(text);
  });

  // Images
  const imgMatches = [...html.matchAll(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  imgMatches.forEach((m) => {
    const altMatch = m[0].match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    elements.images.push({ src: m[1], alt });
  });

  // Links
  const linkMatches = [
    ...html.matchAll(/<a[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ];
  linkMatches.forEach((m) => {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    const href = m[1];
    if (text && href) {
      elements.links.push({ href, text });
    }
  });

  // Metadata from block
  const metadataMatch = html.match(
    /<div class="metadata">([\s\S]*?)<\/div><\/div>/,
  );
  if (metadataMatch) {
    const metaRows = [
      ...metadataMatch[0].matchAll(
        /<div><div>([^<]+)<\/div><div>([\s\S]*?)<\/div><\/div>/g,
      ),
    ];
    metaRows.forEach((row) => {
      const key = row[1].trim().toLowerCase();
      const val = row[2].replace(/<[^>]+>/g, '').trim();
      if (key === 'title') elements.meta.title = val;
      if (key === 'description') elements.meta.description = val;
      if (key === 'og:title') elements.meta.ogTitle = val;
    });
  }

  return elements;
}

function normalizeText(text) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u00A0/g, ' ')
    .replace(/&#x26;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function comparePages(slug) {
  const issues = [];

  // Read migrated content
  const migratedPath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  const migratedHtml = fs.readFileSync(migratedPath, 'utf8');
  const migrated = extractMigratedElements(migratedHtml);

  // Fetch original
  const originalHtml = fetchOriginal(slug);
  if (!originalHtml) {
    return [{ type: 'FETCH_ERROR', detail: 'Could not fetch original page' }];
  }

  const bodyHtml = extractBodyContent(originalHtml);
  const original = extractElements(bodyHtml);

  // 1. Compare headings
  const origH1 = original.headings.filter((h) => h.level === 1);
  const migrH1 = migrated.headings.filter((h) => h.level === 1);

  if (origH1.length > 0 && migrH1.length > 0) {
    const origText = normalizeText(origH1[0].text);
    const migrText = normalizeText(migrH1[0].text);
    if (origText !== migrText) {
      issues.push({
        type: 'H1_MISMATCH',
        original: origText,
        migrated: migrText,
      });
    }
  }

  // Compare H2s
  const origH2 = original.headings
    .filter((h) => h.level === 2)
    .map((h) => normalizeText(h.text));
  const migrH2 = migrated.headings
    .filter((h) => h.level === 2)
    .map((h) => normalizeText(h.text));

  origH2.forEach((oh2) => {
    if (!migrH2.find((mh2) => mh2 === oh2)) {
      issues.push({ type: 'MISSING_H2', detail: oh2 });
    }
  });

  // 2. Compare metadata
  if (original.meta.title && !migrated.meta.title) {
    issues.push({
      type: 'MISSING_META_TITLE',
      original: original.meta.title,
    });
  }
  if (original.meta.description && !migrated.meta.description) {
    issues.push({
      type: 'MISSING_META_DESCRIPTION',
      original: original.meta.description,
    });
  }
  if (original.meta.ogTitle && !migrated.meta.ogTitle) {
    issues.push({
      type: 'MISSING_META_OG_TITLE',
      original: original.meta.ogTitle,
    });
  }

  // 3. Compare image count (body only, excluding nav/footer)
  // Filter original images to only body content images
  const origBodyImages = original.images.filter((img) => {
    const src = img.src.toLowerCase();
    // Skip common nav/footer/icon images
    return !src.includes('/icons/')
      && !src.includes('logo')
      && !src.includes('favicon')
      && !src.includes('/navigation/')
      && !src.includes('/footer/');
  });
  const migrImages = migrated.images;

  if (origBodyImages.length !== migrImages.length) {
    issues.push({
      type: 'IMAGE_COUNT_MISMATCH',
      original: origBodyImages.length,
      migrated: migrImages.length,
      detail: `Original has ${origBodyImages.length} images, `
        + `migrated has ${migrImages.length}`,
    });
  }

  // 4. Check for significant missing paragraphs
  // Compare paragraph count as a rough check
  const origParaTexts = original.paragraphs.map(normalizeText);
  const migrParaTexts = migrated.paragraphs.map(normalizeText);

  const missingParas = [];
  origParaTexts.forEach((op) => {
    if (op.length < 20) return; // skip very short paras
    // Check if any migrated paragraph contains this text (fuzzy match)
    const found = migrParaTexts.some((mp) => {
      if (mp === op) return true;
      // Check for 80%+ substring match
      if (op.length > 50 && mp.includes(op.substring(0, 50))) return true;
      if (mp.length > 50 && op.includes(mp.substring(0, 50))) return true;
      return false;
    });
    if (!found) {
      missingParas.push(op.substring(0, 100));
    }
  });

  if (missingParas.length > 0) {
    issues.push({
      type: 'MISSING_PARAGRAPHS',
      count: missingParas.length,
      samples: missingParas.slice(0, 5),
    });
  }

  // 5. Check for missing links (important editorial links)
  const origBodyLinks = original.links.filter((l) => {
    const href = l.href.toLowerCase();
    // Skip nav links, social, and generic links
    return !href.includes('/who-we-are/our-stories.html')
      && !href.includes('facebook.com')
      && !href.includes('twitter.com')
      && !href.includes('linkedin.com')
      && !href.includes('instagram.com')
      && !href.startsWith('/content/')
      && href.length > 5;
  });

  const migrBodyLinks = migrated.links;
  const missingLinks = [];

  origBodyLinks.forEach((ol) => {
    const found = migrBodyLinks.some((ml) => {
      const normOText = normalizeText(ol.text);
      const normMText = normalizeText(ml.text);
      return normOText === normMText
        || ml.href.includes(ol.href)
        || ol.href.includes(ml.href);
    });
    if (!found && ol.text.length > 3) {
      missingLinks.push({ text: ol.text, href: ol.href });
    }
  });

  if (missingLinks.length > 0) {
    issues.push({
      type: 'MISSING_LINKS',
      count: missingLinks.length,
      links: missingLinks.slice(0, 5),
    });
  }

  return issues;
}

// Main
async function main() {
  const allResults = {};
  let totalIssues = 0;

  for (let i = 0; i < SLUGS.length; i += 1) {
    const slug = SLUGS[i];
    console.log(`[${i + 1}/${SLUGS.length}] Comparing: ${slug}`);

    const issues = comparePages(slug);
    allResults[slug] = issues;

    if (issues.length === 0) {
      console.log('  PASS - no differences');
    } else {
      console.log(`  ${issues.length} issue(s):`);
      issues.forEach((issue) => {
        console.log(
          `    - ${issue.type}: `
          + `${issue.detail || issue.original || issue.count || ''}`,
        );
        if (issue.samples) {
          issue.samples.slice(0, 2).forEach((s) => {
            console.log(`      "${s.substring(0, 80)}..."`);
          });
        }
        if (issue.links) {
          issue.links.slice(0, 2).forEach((l) => {
            console.log(`      "${l.text}" -> ${l.href}`);
          });
        }
      });
      totalIssues += issues.length;
    }
  }

  // Save full report
  const reportPath = path.join(REPORT_DIR, 'comparison-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(`Pages compared: ${SLUGS.length}`);
  console.log(
    `Pages with issues: ${Object.values(allResults).filter((v) => v.length > 0).length}`,
  );
  console.log(`Total issues: ${totalIssues}`);
  console.log(`Report saved: ${reportPath}`);

  // Issue type breakdown
  const typeCount = {};
  Object.values(allResults).forEach((issues) => {
    issues.forEach((issue) => {
      typeCount[issue.type] = (typeCount[issue.type] || 0) + 1;
    });
  });
  console.log('\nIssue breakdown:');
  Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
}

main().catch(console.error);
