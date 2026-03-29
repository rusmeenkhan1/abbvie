#!/usr/bin/env node
/**
 * Adds missing publication dates to cards-related blocks.
 * Fetches original pages to get card dates and injects them into our migrated pages.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');

const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'))
  .sort()
  .slice(0, 25);

function fetchOriginalHTML(slug) {
  try {
    return execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" --max-time 30 "https://www.abbvie.com/who-we-are/our-stories/${slug}.html"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' },
    );
  } catch (e) {
    return null;
  }
}

function extractCardDates(html) {
  // Find card-metadata-date elements in the related stories section
  const dates = [];
  const dateRe = /class="card-metadata-date"[^>]*>\s*([\s\S]*?)\s*<\/span>/gi;
  let m;
  while ((m = dateRe.exec(html)) !== null) {
    const date = m[1].replace(/\s+/g, ' ').trim();
    if (date && /\w+ \d{1,2}, \d{4}/.test(date)) {
      dates.push(date);
    }
  }
  return dates;
}

function extractCardTitles(html) {
  // Find card titles to match against our cards
  const titles = [];
  const titleRe = /class="card-title"[^>]*>([\s\S]*?)<\//gi;
  let m;
  while ((m = titleRe.exec(html)) !== null) {
    titles.push(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  }
  return titles;
}

function addDateToCard(cardHTML, date) {
  // Card structure: <div><div><img...></div><div><p>Category</p><p><strong>Title</strong></p>...
  // Add date before the first <p> in the content div
  // Find the content div (second <div> child)
  const contentStart = cardHTML.indexOf('<div><p>');
  if (contentStart === -1) return cardHTML;

  // Check if a date is already there
  const firstP = cardHTML.match(/<div><p>([^<]*)<\/p>/);
  if (firstP && /\w+ \d{1,2}, \d{4}/.test(firstP[1])) {
    return cardHTML; // Already has a date
  }

  // Insert date paragraph before first <p>
  return `${cardHTML.substring(0, contentStart + 5)}<p>${date}</p>${cardHTML.substring(contentStart + 5)}`;
}

let fixedCount = 0;
let skippedCount = 0;

for (const file of files) {
  const slug = file.replace('.plain.html', '');
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('cards-related')) {
    continue;
  }

  // Check if cards already have dates
  const cardsSection = content.substring(content.indexOf('cards-related'));
  const existingDateCheck = cardsSection.match(/<div><p>(\w+ \d{1,2}, \d{4})<\/p>/);
  if (existingDateCheck) {
    skippedCount++;
    continue;
  }

  // Fetch original to get card dates
  process.stdout.write(`[${slug}] Fetching original... `);
  const originalHTML = fetchOriginalHTML(slug);
  if (!originalHTML) {
    console.log('FAILED to fetch');
    continue;
  }

  const dates = extractCardDates(originalHTML);
  const titles = extractCardTitles(originalHTML);

  if (dates.length === 0) {
    console.log('No card dates found on original');
    continue;
  }

  // Find our cards-related block and extract individual cards
  const cardsMatch = content.match(/<div class="cards-related">([\s\S]*?)<\/div><\/div><\/div>/);
  if (!cardsMatch) {
    console.log('Could not parse cards-related block');
    continue;
  }

  // Count cards in our block
  const cardRows = cardsMatch[1].split(/<\/div><\/div><div>/);

  // We may have fewer dates than cards or vice versa
  // Match by position (dates correspond to card order)
  let modified = false;
  let updatedCards = content;

  // Find the cards-related block start
  const cardsBlockStart = content.indexOf('<div class="cards-related">');
  const cardsBlockEnd = content.indexOf('</div></div></div>', cardsBlockStart);

  if (cardsBlockStart === -1) {
    console.log('Could not find cards block boundaries');
    continue;
  }

  const cardsBlock = content.substring(cardsBlockStart, cardsBlockEnd + 18);

  // For each card in our block, add the corresponding date
  // Cards are: <div><div><img...></div><div><p>Category</p>...
  // Split by card boundaries
  const cardPattern = /<div><div><img[^>]*><\/div><div>/g;
  const matches = [];
  let cm;
  while ((cm = cardPattern.exec(cardsBlock)) !== null) {
    matches.push(cm.index);
  }

  if (matches.length === 0) {
    console.log('No card images found');
    continue;
  }

  // Process in reverse to maintain index positions
  let newCardsBlock = cardsBlock;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (i >= dates.length) continue;

    const cardStart = matches[i];
    // Find the content div's first <p>
    const afterImgDiv = newCardsBlock.indexOf('</div><div><p>', cardStart);
    if (afterImgDiv === -1) continue;

    const insertPoint = afterImgDiv + '</div><div>'.length;

    // Check if date already present
    const existingText = newCardsBlock.substring(insertPoint, insertPoint + 50);
    if (/^<p>\w+ \d{1,2}, \d{4}<\/p>/.test(existingText)) continue;

    newCardsBlock = `${newCardsBlock.substring(0, insertPoint)
    }<p>${dates[i]}</p>${
      newCardsBlock.substring(insertPoint)}`;
    modified = true;
  }

  if (modified) {
    updatedCards = content.substring(0, cardsBlockStart) + newCardsBlock + content.substring(cardsBlockEnd + 18);
    fs.writeFileSync(filePath, updatedCards, 'utf8');
    console.log(`FIXED - added ${Math.min(matches.length, dates.length)} date(s)`);
    fixedCount++;
  } else {
    console.log('No changes needed');
  }
}

console.log('\n=== SUMMARY ===');
console.log(`Fixed: ${fixedCount} pages`);
console.log(`Skipped (already had dates): ${skippedCount}`);
