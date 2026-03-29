#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * For pages missing Description in metadata, extract it from the hero subtitle.
 * The hero-article block's last row contains the article subtitle/intro text.
 */
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.plain.html'));

let fixed = 0;
let failed = 0;

files.forEach((file) => {
  const slug = file.replace('.plain.html', '');
  const filePath = path.join(CONTENT_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already has Description
  if (content.includes('<div>Description</div>')) return;

  if (!content.includes('class="metadata"')) {
    console.log(`SKIP ${slug}: no metadata block`);
    return;
  }

  // Extract hero subtitle - it's the last <div><div>TEXT</div></div> in the hero-article block
  const heroMatch = content.match(/<div class="hero-article">([\s\S]*?)<\/div><\/div><\/div>/);
  let subtitle = '';

  if (heroMatch) {
    // The hero block has rows: image, back-link, date/category/readtime, h1, subtitle
    // Subtitle is the last row before the closing tags
    const heroContent = heroMatch[1];
    // Find the text after h1 section
    const h1EndIdx = heroContent.lastIndexOf('</h1>');
    if (h1EndIdx !== -1) {
      const afterH1 = heroContent.substring(h1EndIdx);
      // Extract text from the subtitle div
      const subtitleMatch = afterH1.match(/<div><div>([^<]+)<\/div>/);
      if (subtitleMatch) {
        subtitle = subtitleMatch[1].trim();
      }
    }
  }

  // If no subtitle found, try to use the first paragraph of body content
  if (!subtitle) {
    const bodyMatch = content.match(
      /<\/div>\s*<div><(?:p|h2|h3)[^>]*>([\s\S]*?)<\/(?:p|h2|h3)>/,
    );
    if (bodyMatch) {
      subtitle = bodyMatch[1].replace(/<[^>]+>/g, '').trim();
    }
  }

  if (!subtitle || subtitle.length < 10) {
    console.log(`FAIL ${slug}: no subtitle/description found`);
    failed += 1;
    return;
  }

  // Truncate to reasonable length
  if (subtitle.length > 200) {
    subtitle = `${subtitle.substring(0, 197)}...`;
  }

  // Add Description row after Title row in metadata
  const titleRowEnd = '</div></div>';
  const titleIdx = content.indexOf('<div><div>Title</div><div>');
  if (titleIdx === -1) {
    console.log(`FAIL ${slug}: no Title in metadata`);
    failed += 1;
    return;
  }

  const afterTitleStart = content.indexOf(titleRowEnd, titleIdx + 25);
  if (afterTitleStart === -1) {
    console.log(`FAIL ${slug}: can't find Title row end`);
    failed += 1;
    return;
  }

  const insertPoint = afterTitleStart + titleRowEnd.length;
  const descRow = `<div><div>Description</div><div>${subtitle}</div></div>`;

  content = content.substring(0, insertPoint) + descRow + content.substring(insertPoint);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`FIXED ${slug}: "${subtitle.substring(0, 60)}..."`);
  fixed += 1;
});

console.log('\n=== SUMMARY ===');
console.log(`Fixed: ${fixed}`);
console.log(`Failed: ${failed}`);

// Verify
let remaining = 0;
files.forEach((file) => {
  const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  if (content.includes('class="metadata"') && !content.includes('<div>Description</div>')) {
    remaining += 1;
    console.log(`  Still missing: ${file.replace('.plain.html', '')}`);
  }
});
console.log(`Remaining without Description: ${remaining}`);
