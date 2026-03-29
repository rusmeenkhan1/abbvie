#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Final verification of the first 25 pages.
 * Checks all structural, content, and metadata requirements.
 */
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');
const existingImages = new Set(fs.readdirSync(IMAGES_DIR));

const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'))
  .sort()
  .slice(0, 25);

console.log(`Final verification of ${files.length} pages\n`);

let passCount = 0;
const failedPages = [];

files.forEach((file) => {
  const slug = file.replace('.plain.html', '');
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // 1. hero-article block
  if (!content.includes('class="hero-article"')) {
    issues.push('Missing hero-article block');
  } else {
    const heroBlock = content.match(
      /<div class="hero-article">([\s\S]*?)<\/div><\/div><\/div>/,
    );
    if (heroBlock) {
      if (!heroBlock[1].includes('<img')) issues.push('Hero: no image');
      if (!heroBlock[1].includes('<h1')) issues.push('Hero: no H1');
      if (!heroBlock[1].includes('All Stories')) issues.push('Hero: no back link');
      if (!heroBlock[1].includes('Minute Read')) issues.push('Hero: no read time');
    }
  }

  // 2. metadata block with all fields
  if (!content.includes('class="metadata"')) {
    issues.push('Missing metadata block');
  } else {
    if (!content.includes('<div>Title</div>')) issues.push('Metadata: no Title');
    if (!content.includes('<div>Description</div>')) issues.push('Metadata: no Description');
    if (!content.includes('<div>og:title</div>')) issues.push('Metadata: no og:title');
  }

  // 3. no empty sections
  if (content.match(/<div>\s*<\/div>/)) issues.push('Empty section(s)');

  // 4. no empty hrefs
  if (content.match(/<a href="">/)) issues.push('Empty href(s)');

  // 5. no empty src
  if (content.match(/src=""/)) issues.push('Empty image src(s)');

  // 6. no external images
  if (content.match(/src="https?:\/\//)) issues.push('External image(s)');

  // 7. no broken image refs
  const localImgs = [...content.matchAll(/src="\.\/(images\/[^"]+)"/g)];
  localImgs.forEach((m) => {
    const imgFile = m[1].replace('images/', '');
    if (!existingImages.has(imgFile)) {
      issues.push(`Broken image: ${imgFile}`);
    }
  });

  // 8. no icon-search.svg placeholders
  if (content.includes('icon-search.svg')) issues.push('icon-search.svg placeholder(s)');

  // 9. single H1
  const h1Count = (content.match(/<h1[^>]*>/g) || []).length;
  if (h1Count === 0) issues.push('No H1');
  if (h1Count > 1) issues.push(`Multiple H1s: ${h1Count}`);

  // 10. body content exists (should have substantial paragraphs)
  const bodyText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (bodyText.length < 200) issues.push('Very short content');

  if (issues.length === 0) {
    passCount += 1;
    console.log(`✓ ${slug}`);
  } else {
    failedPages.push({ slug, issues });
    console.log(`✗ ${slug}`);
    issues.forEach((i) => console.log(`    - ${i}`));
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`FINAL RESULTS: ${passCount}/${files.length} PASSED`);
if (failedPages.length > 0) {
  console.log(`FAILED: ${failedPages.length} pages`);
}
console.log(`${'='.repeat(60)}`);
