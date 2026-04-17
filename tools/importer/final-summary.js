#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');
const existingImages = new Set(fs.readdirSync(IMAGES_DIR));

const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'))
  .sort()
  .slice(0, 25);

// Spot-check card dates
console.log('=== CARD DATE SPOT CHECK ===');
const pagesWithCards = [];
files.forEach((file) => {
  const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  if (content.includes('cards-related')) {
    const cardsBlock = content.substring(content.indexOf('cards-related'));
    const dateMatch = cardsBlock.match(/<p>(\w+ \d{1,2}, \d{4})<\/p>/);
    const slug = file.replace('.plain.html', '');
    pagesWithCards.push(slug);
    console.log(`  ${slug.substring(0, 55).padEnd(57)} Date: ${dateMatch ? dateMatch[1] : 'N/A'}`);
  }
});
console.log(`\nPages with cards-related: ${pagesWithCards.length}/25`);

// Final quality metrics
console.log('\n=== QUALITY METRICS (25 pages) ===');
const stats = {
  hero: 0,
  metadata: 0,
  title: 0,
  desc: 0,
  og: 0,
  noEmptySrc: 0,
  noEmptyHref: 0,
  noExternal: 0,
  noPlaceholder: 0,
  singleH1: 0,
  noBrokenImg: 0,
  substantial: 0,
};

files.forEach((file) => {
  const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');

  if (content.includes('class="hero-article"')) stats.hero += 1;
  if (content.includes('class="metadata"')) stats.metadata += 1;
  if (content.includes('<div>Title</div>')) stats.title += 1;
  if (content.includes('<div>Description</div>')) stats.desc += 1;
  if (content.includes('<div>og:title</div>')) stats.og += 1;
  if (!/src=""/.test(content)) stats.noEmptySrc += 1;
  if (!/<a href="">/.test(content)) stats.noEmptyHref += 1;
  if (!/src="https?:\/\//.test(content)) stats.noExternal += 1;
  if (!content.includes('icon-search.svg')) stats.noPlaceholder += 1;
  if ((content.match(/<h1[^>]*>/g) || []).length === 1) stats.singleH1 += 1;

  // Check broken images
  const localImgs = [...content.matchAll(/src="\.\/(images\/[^"]+)"/g)];
  const allExist = localImgs.every(
    (m) => existingImages.has(m[1].replace('images/', '')),
  );
  if (allExist) stats.noBrokenImg += 1;

  const bodyText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (bodyText.length > 200) stats.substantial += 1;
});

console.log(`  Hero-article block:    ${stats.hero}/25`);
console.log(`  Metadata block:        ${stats.metadata}/25`);
console.log(`  Title field:           ${stats.title}/25`);
console.log(`  Description field:     ${stats.desc}/25`);
console.log(`  og:title field:        ${stats.og}/25`);
console.log(`  No empty src:          ${stats.noEmptySrc}/25`);
console.log(`  No empty href:         ${stats.noEmptyHref}/25`);
console.log(`  No external images:    ${stats.noExternal}/25`);
console.log(`  No placeholder imgs:   ${stats.noPlaceholder}/25`);
console.log(`  Single H1:             ${stats.singleH1}/25`);
console.log(`  No broken images:      ${stats.noBrokenImg}/25`);
console.log(`  Substantial content:   ${stats.substantial}/25`);

const allPerfect = Object.values(stats).every((v) => v === 25);
console.log(`\n${'='.repeat(60)}`);
console.log(`ALL CHECKS PASSED: ${allPerfect ? 'YES - 25/25 PERFECT' : 'NO - See above'}`);
console.log(`${'='.repeat(60)}`);
