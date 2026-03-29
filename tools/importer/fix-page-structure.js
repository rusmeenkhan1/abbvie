#!/usr/bin/env node
/**
 * Fixes structural issues in imported pages:
 * 1. Reconstructs hero-article block wrapper for 3 pages
 * 2. Removes empty sections
 * 3. Fixes empty href="" links (removes the <a> tag, keeps text)
 */
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');

// ====== FIX 1: Hero-article block wrapper ======
function fixHeroArticle(slug) {
  const filePath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Already has hero-article? Skip
  if (content.includes('class="hero-article"')) {
    console.log(`  [hero] ${slug}: already has hero-article, skipping`);
    return;
  }

  // Parse the first section - it should contain:
  // <p><img ...></p>  (hero image)
  // <p><a href="...">All Stories</a></p>  (back link)
  // <p>DATE <a href="...">CATEGORY</a></p>  (date + category)
  // <p>X Minute Read</p>  (read time)
  // <h1 ...>TITLE</h1>  (heading)
  // <p>SUBTITLE</p>  (subtitle)

  // Extract the first <div>...</div> section
  const firstSectionMatch = content.match(/^<div>([\s\S]*?)<\/div>/);
  if (!firstSectionMatch) {
    console.log(`  [hero] ${slug}: can't find first section`);
    return;
  }

  const firstSection = firstSectionMatch[1];

  // Extract image
  const imgMatch = firstSection.match(/<p>(<img[^>]+>)<\/p>/);
  if (!imgMatch) {
    console.log(`  [hero] ${slug}: can't find hero image`);
    return;
  }
  const imgTag = imgMatch[1];

  // Extract back link
  const backLinkMatch = firstSection.match(/<p>(<a href="[^"]*">All Stories<\/a>)<\/p>/);
  const backLinkText = backLinkMatch ? 'All Stories' : '';
  const backLinkHref = backLinkMatch ? backLinkMatch[1].match(/href="([^"]*)"/)[1] : '/who-we-are/our-stories.html';

  // Extract date + category line
  const dateCatMatch = firstSection.match(/<p>([A-Z][a-z]+ \d{1,2}, \d{4})\s*(<a href="[^"]*">([^<]+)<\/a>)?<\/p>/);
  let date = '', category = '';
  if (dateCatMatch) {
    date = dateCatMatch[1];
    category = dateCatMatch[3] || '';
  }

  // Extract read time
  const readTimeMatch = firstSection.match(/<p>(\d+ Minute Read)<\/p>/);
  const readTime = readTimeMatch ? readTimeMatch[1] : '';

  // Extract H1
  const h1Match = firstSection.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1Id = firstSection.match(/<h1 id="([^"]*)">/);
  const h1Text = h1Match ? h1Match[1] : '';
  const h1IdAttr = h1Id ? ` id="${h1Id[1]}"` : '';

  // Extract subtitle (the <p> after h1)
  const afterH1 = firstSection.substring(firstSection.indexOf('</h1>') + 5);
  const subtitleMatch = afterH1.match(/<p>([\s\S]*?)<\/p>/);
  const subtitle = subtitleMatch ? subtitleMatch[1] : '';

  // Build hero-article block
  const heroBlock = `<div class="hero-article"><div><div>${imgTag}</div></div><div><div>${backLinkText}</div><div><a href="${backLinkHref}">${backLinkHref}</a></div></div><div><div>${date}</div><div>${category}</div><div>${readTime}</div></div><div><div><h1${h1IdAttr}>${h1Text}</h1></div></div><div><div>${subtitle}</div></div></div>`;

  // Replace the first section
  const newFirstSection = `<div>${heroBlock}</div>`;
  content = content.replace(firstSectionMatch[0], newFirstSection);

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  [hero] ${slug}: FIXED - reconstructed hero-article block`);
}

// ====== FIX 2: Remove empty sections ======
function fixEmptySections(slug) {
  const filePath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Match empty top-level divs: <div></div> or <div>\n</div>
  const before = content;
  content = content.replace(/<div>(\s*)<\/div>\n?/g, '');

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  [empty] ${slug}: removed empty sections`);
    return true;
  }
  return false;
}

// ====== FIX 3: Fix empty hrefs ======
function fixEmptyHrefs(slug) {
  const filePath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  let content = fs.readFileSync(filePath, 'utf8');

  const before = content;
  // Replace <a href="">text</a> with just text
  content = content.replace(/<a href="">([^<]*)<\/a>/g, '$1');

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    const count = (before.match(/<a href="">/g) || []).length;
    console.log(`  [href] ${slug}: fixed ${count} empty hrefs`);
    return true;
  }
  return false;
}

// ====== MAIN ======
function main() {
  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.plain.html'))
    .sort();

  console.log(`Processing ${files.length} pages...\n`);

  // Fix hero-article on known broken pages
  console.log('=== Fixing hero-article blocks ===');
  const heroPages = [
    'a-journey-of-sight-progress',
    'day-in-life-meet-director-clearing-path-for-patient-access',
    'the-math-of-migraine',
  ];
  for (const slug of heroPages) {
    fixHeroArticle(slug);
  }

  // Fix empty sections
  console.log('\n=== Removing empty sections ===');
  let emptySectionsFixed = 0;
  for (const file of files) {
    const slug = file.replace('.plain.html', '');
    if (fixEmptySections(slug)) emptySectionsFixed++;
  }
  console.log(`Fixed ${emptySectionsFixed} pages with empty sections`);

  // Fix empty hrefs
  console.log('\n=== Fixing empty hrefs ===');
  let emptyHrefsFixed = 0;
  for (const file of files) {
    const slug = file.replace('.plain.html', '');
    if (fixEmptyHrefs(slug)) emptyHrefsFixed++;
  }
  console.log(`Fixed ${emptyHrefsFixed} pages with empty hrefs`);

  // Verify
  console.log('\n=== Verification ===');
  let remainingNoHero = 0;
  let remainingEmptySections = 0;
  let remainingEmptyHrefs = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    if (!content.includes('class="hero-article"')) remainingNoHero++;
    if (content.match(/<div>(\s*)<\/div>/)) remainingEmptySections++;
    if (content.match(/<a href="">/)) remainingEmptyHrefs++;
  }
  console.log(`Remaining: no hero-article=${remainingNoHero}, empty sections=${remainingEmptySections}, empty hrefs=${remainingEmptyHrefs}`);
}

main();
