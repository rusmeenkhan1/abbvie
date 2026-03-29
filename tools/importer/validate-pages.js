#!/usr/bin/env node
/**
 * Validates all imported pages have correct EDS structure.
 * Compares against the reference structure of known-good pages.
 */
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'))
  .sort();

console.log(`Validating ${files.length} pages...\n`);

const existingImages = new Set(fs.readdirSync(IMAGES_DIR));

const issues = [];
let passCount = 0;

for (const file of files) {
  const slug = file.replace('.plain.html', '');
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const pageIssues = [];

  // ===== SECTION STRUCTURE =====
  // Expected: 3-4 top-level <div> sections
  // Section 1: Hero (with hero-article block)
  // Section 2: Body content
  // Section 3 (optional): Cards-related section
  // Section 3/4: Metadata section

  // Count top-level sections by splitting on ></div>\n<div> pattern
  const topDivCount = (content.match(/^<div>/gm) || []).length;

  // Check hero-article block exists
  if (!content.includes('class="hero-article"')) {
    pageIssues.push('CRITICAL: Missing hero-article block');
  } else {
    // Validate hero-article internal structure
    const heroMatch = content.match(/<div class="hero-article">([\s\S]*?)<\/div><\/div>\s*<\/div>/);
    if (heroMatch) {
      const heroContent = heroMatch[1];
      // Check for image
      if (!heroContent.includes('<img')) {
        pageIssues.push('Hero: Missing image');
      }
      // Check for H1
      if (!heroContent.includes('<h1')) {
        pageIssues.push('Hero: Missing H1');
      }
      // Check for All Stories link
      if (!heroContent.includes('All Stories')) {
        pageIssues.push('Hero: Missing "All Stories" back link');
      }
      // Check for date/category/read-time row
      if (!heroContent.includes('Minute Read')) {
        pageIssues.push('Hero: Missing read time');
      }
    }
  }

  // Check metadata block exists
  if (!content.includes('class="metadata"')) {
    pageIssues.push('CRITICAL: Missing metadata block');
  } else {
    // Check metadata has Title
    if (!content.match(/<div>Title<\/div>/)) {
      pageIssues.push('Metadata: Missing Title');
    }
    // Check metadata has Description
    if (!content.match(/<div>Description<\/div>/)) {
      pageIssues.push('Metadata: Missing Description');
    }
  }

  // Check for empty sections
  if (content.match(/<div>\s*<\/div>/)) {
    pageIssues.push('Empty section found');
  }

  // Check for empty hrefs
  const emptyHrefs = (content.match(/<a href="">/g) || []).length;
  if (emptyHrefs > 0) {
    pageIssues.push(`${emptyHrefs} empty href(s)`);
  }

  // Check for empty src on images
  const emptySrc = (content.match(/src=""/g) || []).length;
  if (emptySrc > 0) {
    pageIssues.push(`${emptySrc} empty image src(s)`);
  }

  // Check for external images
  const externalImgs = (content.match(/src="https?:\/\//g) || []).length;
  if (externalImgs > 0) {
    pageIssues.push(`${externalImgs} external image(s)`);
  }

  // Check for broken local image references
  const localImgMatches = [...content.matchAll(/src="\.\/(images\/[^"]+)"/g)];
  for (const m of localImgMatches) {
    const imgFile = m[1].replace('images/', '');
    if (!existingImages.has(imgFile)) {
      pageIssues.push(`Broken image ref: ${imgFile}`);
    }
  }

  // Check body content section has content
  // The body section is the 2nd top-level div
  const sections = content.split(/(?=<div>)/g).filter((s) => s.startsWith('<div>'));
  if (sections.length >= 2) {
    const bodySection = sections[1];
    // Body should have at least some text content
    const textContent = bodySection.replace(/<[^>]+>/g, '').trim();
    if (textContent.length < 50) {
      pageIssues.push(`Body content very short (${textContent.length} chars)`);
    }
  }

  // Check for multiple H1s
  const h1Count = (content.match(/<h1[^>]*>/g) || []).length;
  if (h1Count > 1) {
    pageIssues.push(`Multiple H1 tags: ${h1Count}`);
  }

  // Check last section is metadata
  if (sections.length > 0) {
    const lastSection = sections[sections.length - 1];
    if (!lastSection.includes('class="metadata"')) {
      pageIssues.push('Last section is not metadata');
    }
  }

  if (pageIssues.length === 0) {
    passCount++;
  } else {
    issues.push({ slug, issues: pageIssues });
  }
}

// Print results
console.log('=== VALIDATION RESULTS ===\n');

if (issues.length === 0) {
  console.log(`ALL ${files.length} PAGES PASSED VALIDATION!`);
} else {
  console.log(`PASSED: ${passCount}/${files.length}`);
  console.log(`FAILED: ${issues.length}/${files.length}\n`);

  // Group by issue type
  const issueTypes = {};
  for (const page of issues) {
    for (const issue of page.issues) {
      const type = issue.split(':')[0].trim();
      if (!issueTypes[type]) issueTypes[type] = [];
      issueTypes[type].push(page.slug);
    }
  }

  console.log('Issues by type:');
  for (const [type, pages] of Object.entries(issueTypes).sort()) {
    console.log(`\n  ${type}: ${pages.length} pages`);
    pages.forEach((p) => console.log(`    - ${p}`));
  }

  console.log('\n\nDetailed per-page issues:');
  for (const page of issues) {
    console.log(`\n  ${page.slug}:`);
    page.issues.forEach((i) => console.log(`    - ${i}`));
  }
}
