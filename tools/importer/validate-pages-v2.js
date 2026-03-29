#!/usr/bin/env node
/**
 * Validates all imported pages have correct EDS structure.
 * v2: Fixed section parsing to handle the actual .plain.html format.
 */
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

const files = fs.readdirSync(CONTENT_DIR)
  .filter(f => f.endsWith('.plain.html'))
  .sort();

console.log(`Validating ${files.length} pages...\n`);

const existingImages = new Set(fs.existsSync(IMAGES_DIR) ? fs.readdirSync(IMAGES_DIR) : []);

const realIssues = [];
let passCount = 0;

for (const file of files) {
  const slug = file.replace('.plain.html', '');
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const pageIssues = [];

  // 1. hero-article block
  if (!content.includes('class="hero-article"')) {
    pageIssues.push('Missing hero-article block');
  } else {
    // Check hero has image, h1, back link
    const heroBlock = content.match(/<div class="hero-article">([\s\S]*?)<\/div><\/div><\/div>/);
    if (heroBlock) {
      if (!heroBlock[1].includes('<img')) pageIssues.push('Hero: no image');
      if (!heroBlock[1].includes('<h1')) pageIssues.push('Hero: no H1');
    }
  }

  // 2. metadata block
  if (!content.includes('class="metadata"')) {
    pageIssues.push('Missing metadata block');
  } else {
    if (!content.includes('<div>Title</div>')) pageIssues.push('Metadata: missing Title');
    if (!content.includes('<div>Description</div>')) pageIssues.push('Metadata: missing Description');
    if (!content.includes('<div>og:title</div>')) pageIssues.push('Metadata: missing og:title');
  }

  // 3. empty sections
  if (content.match(/<div>\s*<\/div>/)) {
    pageIssues.push('Empty section(s)');
  }

  // 4. empty hrefs
  const emptyHrefs = (content.match(/<a href="">/g) || []).length;
  if (emptyHrefs > 0) pageIssues.push(`${emptyHrefs} empty href(s)`);

  // 5. empty/external/broken images
  const emptySrc = (content.match(/src=""/g) || []).length;
  if (emptySrc > 0) pageIssues.push(`${emptySrc} empty image src(s)`);

  const externalImgs = (content.match(/src="https?:\/\//g) || []).length;
  if (externalImgs > 0) pageIssues.push(`${externalImgs} external image(s)`);

  const localImgMatches = [...content.matchAll(/src="\.\/(images\/[^"]+)"/g)];
  for (const m of localImgMatches) {
    const imgFile = m[1].replace('images/', '');
    if (!existingImages.has(imgFile)) {
      pageIssues.push(`Broken image: ${imgFile}`);
    }
  }

  // 6. multiple H1s
  const h1Count = (content.match(/<h1[^>]*>/g) || []).length;
  if (h1Count === 0) pageIssues.push('No H1 found');
  if (h1Count > 1) pageIssues.push(`Multiple H1s: ${h1Count}`);

  // 7. Body content check - second section should have substantial content
  // Parse the content between first </div> and cards-related or metadata section
  const bodyText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (bodyText.length < 100) pageIssues.push('Very little text content');

  if (pageIssues.length === 0) {
    passCount++;
  } else {
    realIssues.push({ slug, issues: pageIssues });
  }
}

// Print results
console.log('=== VALIDATION RESULTS ===\n');
console.log(`PASSED: ${passCount}/${files.length}`);

if (realIssues.length > 0) {
  console.log(`ISSUES: ${realIssues.length}/${files.length}\n`);

  // Group by issue type
  const issueTypes = {};
  for (const page of realIssues) {
    for (const issue of page.issues) {
      if (!issueTypes[issue]) issueTypes[issue] = [];
      issueTypes[issue].push(page.slug);
    }
  }

  console.log('Issues by type:');
  for (const [type, pages] of Object.entries(issueTypes).sort()) {
    console.log(`\n  "${type}": ${pages.length} pages`);
    if (pages.length <= 10) {
      pages.forEach(p => console.log(`    - ${p}`));
    } else {
      pages.slice(0, 5).forEach(p => console.log(`    - ${p}`));
      console.log(`    ... and ${pages.length - 5} more`);
    }
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total pages: ${files.length}`);
console.log(`Clean pages: ${passCount}`);
console.log(`Pages with issues: ${realIssues.length}`);
