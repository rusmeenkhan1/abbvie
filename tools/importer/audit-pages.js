#!/usr/bin/env node
/**
 * Comprehensive audit of all imported pages for structural/content issues.
 * Checks: hero-article block, cards-related block, metadata, empty sections,
 * broken images, section structure, and content quality.
 */
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'))
  .sort();

console.log(`Auditing ${files.length} pages...\n`);

const issues = {
  missingHeroArticle: [],
  missingCardsRelated: [],
  missingMetadata: [],
  emptySections: [],
  brokenImageRefs: [],
  externalImages: [],
  emptyImages: [],
  emptyHrefs: [],
  duplicateImages: [],
  missingH1: [],
  multipleH1: [],
  emptyAltOnImages: [],
  malformedHtml: [],
};

const existingImages = new Set(fs.existsSync(IMAGES_DIR) ? fs.readdirSync(IMAGES_DIR) : []);

for (const file of files) {
  const slug = file.replace('.plain.html', '');
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Parse sections (top-level divs)
  const sections = content.match(/<div>[\s\S]*?<\/div>\s*(?=<div>|$)/g) || [];

  // 1. Check hero-article block
  if (!content.includes('class="hero-article"')) {
    issues.missingHeroArticle.push(slug);
  }

  // 2. Check cards-related block
  if (!content.includes('class="cards-related"')) {
    issues.missingCardsRelated.push(slug);
  }

  // 3. Check metadata block
  if (!content.includes('class="metadata"')) {
    issues.missingMetadata.push(slug);
  }

  // 4. Check empty sections
  const topDivs = content.match(/<div>(?:\s*)<\/div>/g);
  if (topDivs) {
    issues.emptySections.push({ slug, count: topDivs.length });
  }

  // 5. Check image references
  const imgSrcMatches = [...content.matchAll(/src="([^"]*)"/g)];
  for (const m of imgSrcMatches) {
    const src = m[1];
    if (src === '') {
      issues.emptyImages.push({ slug, context: m[0] });
    } else if (src.startsWith('https://') || src.startsWith('http://')) {
      issues.externalImages.push({ slug, src });
    } else if (src.startsWith('./images/')) {
      const filename = src.replace('./images/', '');
      if (!existingImages.has(filename)) {
        issues.brokenImageRefs.push({ slug, src });
      }
    }
  }

  // 6. Check empty href
  const hrefMatches = [...content.matchAll(/href="([^"]*)"/g)];
  for (const m of hrefMatches) {
    if (m[1] === '') {
      issues.emptyHrefs.push({ slug, context: content.substring(Math.max(0, m.index - 30), m.index + 50).replace(/\n/g, ' ') });
    }
  }

  // 7. Check H1 count
  const h1Matches = content.match(/<h1[^>]*>/g);
  if (!h1Matches) {
    issues.missingH1.push(slug);
  } else if (h1Matches.length > 1) {
    issues.multipleH1.push({ slug, count: h1Matches.length });
  }

  // 8. Check empty alt text on images
  const emptyAltMatches = [...content.matchAll(/<img[^>]*alt=""[^>]*>/g)];
  if (emptyAltMatches.length > 0) {
    issues.emptyAltOnImages.push({ slug, count: emptyAltMatches.length });
  }
}

// Print report
console.log('=== AUDIT REPORT ===\n');

console.log(`1. MISSING HERO-ARTICLE BLOCK: ${issues.missingHeroArticle.length} pages`);
issues.missingHeroArticle.forEach((s) => console.log(`   - ${s}`));

console.log(`\n2. MISSING CARDS-RELATED BLOCK: ${issues.missingCardsRelated.length} pages`);
issues.missingCardsRelated.forEach((s) => console.log(`   - ${s}`));

console.log(`\n3. MISSING METADATA: ${issues.missingMetadata.length} pages`);
issues.missingMetadata.forEach((s) => console.log(`   - ${s}`));

console.log(`\n4. EMPTY SECTIONS: ${issues.emptySections.length} pages`);
issues.emptySections.forEach((s) => console.log(`   - ${s.slug} (${s.count} empty sections)`));

console.log(`\n5. BROKEN IMAGE REFS: ${issues.brokenImageRefs.length}`);
issues.brokenImageRefs.forEach((s) => console.log(`   - ${s.slug}: ${s.src}`));

console.log(`\n6. EXTERNAL IMAGES: ${issues.externalImages.length}`);
issues.externalImages.forEach((s) => console.log(`   - ${s.slug}: ${s.src}`));

console.log(`\n7. EMPTY SRC IMAGES: ${issues.emptyImages.length}`);
issues.emptyImages.forEach((s) => console.log(`   - ${s.slug}`));

console.log(`\n8. EMPTY HREFS: ${issues.emptyHrefs.length}`);
issues.emptyHrefs.forEach((s) => console.log(`   - ${s.slug}: ...${s.context}...`));

console.log(`\n9. MISSING H1: ${issues.missingH1.length} pages`);
issues.missingH1.forEach((s) => console.log(`   - ${s}`));

console.log(`\n10. MULTIPLE H1s: ${issues.multipleH1.length} pages`);
issues.multipleH1.forEach((s) => console.log(`   - ${s.slug} (${s.count} h1s)`));

console.log(`\n11. EMPTY ALT ON IMAGES: ${issues.emptyAltOnImages.length} pages`);
issues.emptyAltOnImages.forEach((s) => console.log(`   - ${s.slug} (${s.count} images)`));

// Summary
const totalIssues = issues.missingHeroArticle.length + issues.missingCardsRelated.length
  + issues.missingMetadata.length + issues.emptySections.length + issues.brokenImageRefs.length
  + issues.externalImages.length + issues.emptyImages.length + issues.emptyHrefs.length
  + issues.missingH1.length + issues.multipleH1.length + issues.emptyAltOnImages.length;

console.log('\n=== SUMMARY ===');
console.log(`Total pages: ${files.length}`);
console.log(`Total issues: ${totalIssues}`);
console.log(`Pages with missing hero-article: ${issues.missingHeroArticle.length}`);
console.log(`Pages with missing cards-related: ${issues.missingCardsRelated.length}`);
console.log(`Pages with empty sections: ${issues.emptySections.length}`);
console.log(`Pages with empty alt text: ${issues.emptyAltOnImages.length}`);
console.log(`Empty hrefs: ${issues.emptyHrefs.length}`);
