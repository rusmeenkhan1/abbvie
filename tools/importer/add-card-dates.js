#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Adds missing publication dates to cards-related blocks.
 * Fetches original pages to get card dates and injects them
 * into our migrated pages.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(
  __dirname,
  '../../content/who-we-are/our-stories',
);

const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'))
  .sort()
  .slice(0, 25);

function fetchOriginalHTML(slug) {
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    + ' AppleWebKit/537.36';
  const base = 'https://www.abbvie.com/who-we-are/our-stories';
  const cmd = `curl -sL -H "User-Agent: ${ua}"`
    + ` --max-time 30 "${base}/${slug}.html"`;
  try {
    return execSync(
      cmd,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' },
    );
  } catch (_e) {
    return null;
  }
}

function extractCardDates(html) {
  const dates = [];
  const dateRe = /class="card-metadata-date"[^>]*>\s*([\s\S]*?)\s*<\/span>/gi;
  let m = dateRe.exec(html);
  while (m !== null) {
    const date = m[1].replace(/\s+/g, ' ').trim();
    if (date && /\w+ \d{1,2}, \d{4}/.test(date)) {
      dates.push(date);
    }
    m = dateRe.exec(html);
  }
  return dates;
}

let fixedCount = 0;
let skippedCount = 0;

files.forEach((file) => {
  const slug = file.replace('.plain.html', '');
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('cards-related')) {
    return;
  }

  // Check if cards already have dates
  const cardsSection = content.substring(
    content.indexOf('cards-related'),
  );
  const existingDateCheck = cardsSection.match(
    /<div><p>(\w+ \d{1,2}, \d{4})<\/p>/,
  );
  if (existingDateCheck) {
    skippedCount += 1;
    return;
  }

  // Fetch original to get card dates
  process.stdout.write(`[${slug}] Fetching original... `);
  const originalHTML = fetchOriginalHTML(slug);
  if (!originalHTML) {
    console.log('FAILED to fetch');
    return;
  }

  const dates = extractCardDates(originalHTML);

  if (dates.length === 0) {
    console.log('No card dates found on original');
    return;
  }

  // Find our cards-related block and extract individual cards
  const cardsMatch = content.match(
    /<div class="cards-related">([\s\S]*?)<\/div><\/div><\/div>/,
  );
  if (!cardsMatch) {
    console.log('Could not parse cards-related block');
    return;
  }

  // Find the cards-related block start
  const cardsBlockStart = content.indexOf(
    '<div class="cards-related">',
  );
  const cardsBlockEnd = content.indexOf(
    '</div></div></div>',
    cardsBlockStart,
  );

  if (cardsBlockStart === -1) {
    console.log('Could not find cards block boundaries');
    return;
  }

  const cardsBlock = content.substring(
    cardsBlockStart,
    cardsBlockEnd + 18,
  );

  // For each card in our block, add the corresponding date
  const cardPattern = /<div><div><img[^>]*><\/div><div>/g;
  const matches = [];
  let cm = cardPattern.exec(cardsBlock);
  while (cm !== null) {
    matches.push(cm.index);
    cm = cardPattern.exec(cardsBlock);
  }

  if (matches.length === 0) {
    console.log('No card images found');
    return;
  }

  // Process in reverse to maintain index positions
  let modified = false;
  let newCardsBlock = cardsBlock;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    if (i < dates.length) {
      const cardStart = matches[i];
      const afterImgDiv = newCardsBlock.indexOf(
        '</div><div><p>',
        cardStart,
      );
      if (afterImgDiv !== -1) {
        const insertPoint = afterImgDiv + '</div><div>'.length;
        const existingText = newCardsBlock.substring(
          insertPoint,
          insertPoint + 50,
        );
        if (!/^<p>\w+ \d{1,2}, \d{4}<\/p>/.test(existingText)) {
          newCardsBlock = `${newCardsBlock.substring(0, insertPoint)
          }<p>${dates[i]}</p>${
            newCardsBlock.substring(insertPoint)}`;
          modified = true;
        }
      }
    }
  }

  if (modified) {
    const updatedCards = content.substring(0, cardsBlockStart)
      + newCardsBlock
      + content.substring(cardsBlockEnd + 18);
    fs.writeFileSync(filePath, updatedCards, 'utf8');
    const dateCount = Math.min(matches.length, dates.length);
    console.log(`FIXED - added ${dateCount} date(s)`);
    fixedCount += 1;
  } else {
    console.log('No changes needed');
  }
});

console.log('\n=== SUMMARY ===');
console.log(`Fixed: ${fixedCount} pages`);
console.log(`Skipped (already had dates): ${skippedCount}`);
