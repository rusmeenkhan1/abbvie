#!/usr/bin/env node
/**
 * Precise comparison of migrated pages vs original AbbVie pages.
 * Focuses on actual body content differences, excluding header/footer/nav.
 * Uses the article body section only.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');

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
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Extract article body text from original AbbVie page
function extractOriginalArticle(html) {
  // AbbVie uses specific classes for article content
  // Find the article/story content area - usually after the hero section
  // The actual text content is in div.text elements within the story sections

  const result = {
    h1: '',
    h2s: [],
    h5s: [],
    bodyParagraphs: [], // Key body text paragraphs
    bodyImages: [], // Image alt texts in body
    bodyLinks: [], // Editorial links in body
    metaTitle: '',
    metaDescription: '',
    metaOgTitle: '',
  };

  // Extract metadata
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) result.metaTitle = titleMatch[1].trim();

  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) result.metaDescription = descMatch[1].trim();

  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  if (ogTitleMatch) result.metaOgTitle = ogTitleMatch[1].trim();

  // Extract body content - between </header> and footer/experiencefragment
  let body = html;
  const headerEnd = html.indexOf('</header>');
  if (headerEnd > -1) body = html.substring(headerEnd + 9);

  // Cut at footer or experience fragment
  const footerMatch = body.search(/<footer|class="experiencefragment.*footer/i);
  if (footerMatch > -1) body = body.substring(0, footerMatch);

  // Also cut at "Related" section or cards
  const relatedMatch = body.search(/class="stories-related|class="related-stories|class="cards/i);
  if (relatedMatch > -1) body = body.substring(0, relatedMatch);

  // Extract headings from body
  const h1Matches = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (h1Matches.length > 0) {
    result.h1 = h1Matches[0][1].replace(/<[^>]+>/g, '').trim();
  }

  const h2Matches = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  for (const m of h2Matches) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text) result.h2s.push(text);
  }

  const h5Matches = [...body.matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>/gi)];
  for (const m of h5Matches) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text) result.h5s.push(text);
  }

  // Extract paragraphs from body - get all text content
  const pMatches = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  for (const m of pMatches) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    // Skip very short, navigation-like, or metadata paragraphs
    if (text.length > 30 && !text.match(/^\d+ Minute Read$/) && !text.match(/^All Stories$/)) {
      result.bodyParagraphs.push(text);
    }
  }

  // Extract images from body
  const imgMatches = [...body.matchAll(/<img[^>]*\balt=["']([^"']*)["'][^>]*>/gi)];
  for (const m of imgMatches) {
    const alt = m[1].trim();
    if (alt && !alt.includes('icon') && !alt.includes('logo') && alt.length > 2) {
      result.bodyImages.push(alt);
    }
  }
  // Also reverse pattern
  const imgMatches2 = [...body.matchAll(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*\balt=["']([^"']*)["'][^>]*>/gi)];
  for (const m of imgMatches2) {
    const alt = m[2].trim();
    if (alt && !result.bodyImages.includes(alt) && !alt.includes('icon') && !alt.includes('logo') && alt.length > 2) {
      result.bodyImages.push(alt);
    }
  }

  // Extract editorial links from body
  const linkMatches = [...body.matchAll(/<a[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of linkMatches) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    // Skip nav/footer/header links, social links, email protection
    if (text && text.length > 2 && href.length > 5
        && !href.includes('/cdn-cgi/')
        && !href.includes('facebook.com')
        && !href.includes('twitter.com')
        && !href.includes('linkedin.com')
        && !href.includes('youtube.com/@')
        && !href.includes('/who-we-are.html')
        && !href.includes('/science.html')
        && !href.includes('/patients.html')
        && !href.includes('/join-us.html')
        && !href.includes('/sustainability.html')
        && !href.startsWith('/who-we-are/our-stories.html')
        && !href.includes('news.abbvie.com')
        && !href.includes('investors.abbvie.com')
        && !href.includes('abbviecontractmfg.com')
        && !href.includes('abbviemedinfo.com')
        && !href.includes('contact-center.html')
        && !href.includes('accessibility-statement')
        && !href.includes('site-map.html')
        && !href.includes('terms-of-use')
        && !href.includes('privacy')
        && text !== 'Who We Are' && text !== 'Science' && text !== 'Patients'
        && text !== 'Join Us' && text !== 'Sustainability') {
      result.bodyLinks.push({ href, text });
    }
  }

  return result;
}

// Extract from migrated file
function extractMigrated(html) {
  const result = {
    h1: '',
    h2s: [],
    h5s: [],
    bodyParagraphs: [],
    bodyImages: [],
    bodyLinks: [],
    metaTitle: '',
    metaDescription: '',
    metaOgTitle: '',
    heroDate: '',
    heroCategory: '',
    heroReadTime: '',
    heroSubtitle: '',
  };

  // Headings from full content (including hero)
  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (h1Matches.length > 0) result.h1 = h1Matches[0][1].replace(/<[^>]+>/g, '').trim();

  const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  for (const m of h2Matches) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text) result.h2s.push(text);
  }

  const h5Matches = [...html.matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>/gi)];
  for (const m of h5Matches) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text) result.h5s.push(text);
  }

  // Extract body paragraphs (from all sections, not just hero)
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  for (const m of pMatches) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 30) {
      result.bodyParagraphs.push(text);
    }
  }

  // Images
  const imgMatches = [...html.matchAll(/<img[^>]*\balt=["']([^"']*)["'][^>]*>/gi)];
  for (const m of imgMatches) {
    const alt = m[1].trim();
    if (alt && alt.length > 2) result.bodyImages.push(alt);
  }

  // Links
  const linkMatches = [...html.matchAll(/<a[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of linkMatches) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text && text.length > 2 && href.length > 5
        && !href.startsWith('/who-we-are/our-stories.html')
        && text !== 'All Stories'
        && text !== 'Read Article'
        && text !== 'Read story') {
      result.bodyLinks.push({ href, text });
    }
  }

  // Metadata
  const metadataMatch = html.match(/<div class="metadata">([\s\S]*?)<\/div><\/div>/);
  if (metadataMatch) {
    const metaRows = [...metadataMatch[0].matchAll(/<div><div>([^<]+)<\/div><div>([\s\S]*?)<\/div><\/div>/g)];
    for (const row of metaRows) {
      const key = row[1].trim().toLowerCase();
      const val = row[2].replace(/<[^>]+>/g, '').trim();
      if (key === 'title') result.metaTitle = val;
      if (key === 'description') result.metaDescription = val;
      if (key === 'og:title') result.metaOgTitle = val;
    }
  }

  return result;
}

function comparePage(slug) {
  const issues = [];
  const filePath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  const migratedHtml = fs.readFileSync(filePath, 'utf8');
  const migrated = extractMigrated(migratedHtml);

  const originalHtml = fetchOriginal(slug);
  if (!originalHtml) return [{ type: 'FETCH_ERROR' }];
  const original = extractOriginalArticle(originalHtml);

  // 1. H1 comparison
  if (normalizeText(original.h1) !== normalizeText(migrated.h1)) {
    issues.push({ type: 'H1_DIFF', orig: original.h1, migr: migrated.h1 });
  }

  // 2. H2 comparison
  for (const oh2 of original.h2s) {
    const normO = normalizeText(oh2);
    if (!migrated.h2s.some((mh2) => normalizeText(mh2) === normO)) {
      issues.push({ type: 'MISSING_H2', text: oh2 });
    }
  }

  // 3. H5 comparison (sub-headings)
  for (const oh5 of original.h5s) {
    const normO = normalizeText(oh5);
    if (!migrated.h5s.some((mh5) => normalizeText(mh5) === normO)) {
      issues.push({ type: 'MISSING_H5', text: oh5 });
    }
  }

  // 4. Body paragraph comparison - check for missing substantial content
  const migrNormParas = migrated.bodyParagraphs.map(normalizeText);
  let missingParas = 0;
  const missingParaSamples = [];

  for (const op of original.bodyParagraphs) {
    const normO = normalizeText(op);
    if (normO.length < 30) continue;

    const found = migrNormParas.some((mp) => {
      if (mp === normO) return true;
      // Fuzzy: check 40-char substring match
      const sub = normO.substring(0, 40);
      return mp.includes(sub);
    });

    if (!found) {
      missingParas++;
      if (missingParaSamples.length < 3) {
        missingParaSamples.push(op.substring(0, 120));
      }
    }
  }

  if (missingParas > 0) {
    issues.push({ type: 'MISSING_BODY_TEXT', count: missingParas, samples: missingParaSamples });
  }

  // 5. Metadata comparison
  if (original.metaTitle && !migrated.metaTitle) {
    issues.push({ type: 'MISSING_META_TITLE', value: original.metaTitle });
  }
  if (original.metaDescription && !migrated.metaDescription) {
    issues.push({ type: 'MISSING_META_DESC', value: original.metaDescription });
  }
  if (original.metaOgTitle && !migrated.metaOgTitle) {
    issues.push({ type: 'MISSING_META_OG_TITLE', value: original.metaOgTitle });
  }

  // 6. Editorial link comparison
  const migrLinkTexts = migrated.bodyLinks.map((l) => normalizeText(l.text));
  const missingLinks = [];
  for (const ol of original.bodyLinks) {
    const normText = normalizeText(ol.text);
    if (normText.length < 3) continue;
    // Skip category links (already in hero metadata)
    if (ol.href.includes('/our-stories/') && ol.href.includes('-stories.html')) continue;
    // Skip email/phone links
    if (ol.href.startsWith('mailto:') || ol.href.startsWith('tel:')) continue;

    if (!migrLinkTexts.some((mt) => mt === normText || mt.includes(normText) || normText.includes(mt))) {
      missingLinks.push({ text: ol.text, href: ol.href });
    }
  }

  if (missingLinks.length > 0) {
    issues.push({ type: 'MISSING_EDITORIAL_LINKS', count: missingLinks.length, links: missingLinks.slice(0, 5) });
  }

  // 7. Image count (body only)
  const origImgCount = original.bodyImages.length;
  const migrImgCount = migrated.bodyImages.length;
  if (Math.abs(origImgCount - migrImgCount) > 1) {
    issues.push({ type: 'IMAGE_COUNT_DIFF', orig: origImgCount, migr: migrImgCount });
  }

  return issues;
}

async function main() {
  let totalIssuePages = 0;
  let totalIssueCount = 0;
  const issueSummary = {};

  for (let i = 0; i < SLUGS.length; i++) {
    const slug = SLUGS[i];
    process.stdout.write(`[${i + 1}/${SLUGS.length}] ${slug} ... `);

    const issues = comparePage(slug);

    if (issues.length === 0) {
      console.log('PASS');
    } else {
      console.log(`${issues.length} issue(s):`);
      for (const issue of issues) {
        const summary = issue.type === 'MISSING_BODY_TEXT'
          ? `${issue.count} paras - ${issue.samples[0]?.substring(0, 80)}`
          : issue.type === 'MISSING_EDITORIAL_LINKS'
            ? `${issue.count} links - ${issue.links[0]?.text}`
            : issue.text || issue.value || `orig=${issue.orig}, migr=${issue.migr}`;
        console.log(`  - ${issue.type}: ${summary}`);
        issueSummary[issue.type] = (issueSummary[issue.type] || 0) + 1;
      }
      totalIssuePages++;
      totalIssueCount += issues.length;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Pages: ${SLUGS.length}, Clean: ${SLUGS.length - totalIssuePages}, With issues: ${totalIssuePages}`);
  console.log(`Total issue instances: ${totalIssueCount}`);
  console.log('\nBreakdown:');
  for (const [type, count] of Object.entries(issueSummary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
}

main().catch(console.error);
