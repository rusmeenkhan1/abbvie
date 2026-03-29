#!/usr/bin/env node
/**
 * Fixes malformed cards-related blocks on specific pages by
 * fetching card content from original pages.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

const pages = [
  'change-from-within',
  'day-in-the-life-creating-impact-with-nonprofit-partners',
];

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

function extractCards(html) {
  const cards = [];
  // Find card containers - these are in the "related stories" section near the bottom
  const cardRe = /class="card-container[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const cardHTML = m[0];

    // Extract date
    const dateMatch = cardHTML.match(/class="card-metadata-date"[^>]*>\s*([\s\S]*?)\s*<\/span>/);
    const date = dateMatch ? dateMatch[1].replace(/\s+/g, ' ').trim() : null;

    // Extract category
    const catMatch = cardHTML.match(/class="card-metadata-tag"[^>]*>([\s\S]*?)<\/span>/);
    const category = catMatch ? catMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Extract title
    const titleMatch = cardHTML.match(/class="card-title"[^>]*>([\s\S]*?)<\/h\d>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Extract description
    const descMatch = cardHTML.match(/class="card-description"[^>]*>([\s\S]*?)<\/p>/);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Extract link
    const linkMatch = cardHTML.match(/href="([^"]*)"[^>]*class="[^"]*card-link/);
    const link = linkMatch ? linkMatch[1] : null;

    // Extract image
    const imgMatch = cardHTML.match(/src="([^"]*scene7[^"]*)"/);
    const imgSrc = imgMatch ? imgMatch[1] : null;
    const altMatch = cardHTML.match(/alt="([^"]*)"/);
    const imgAlt = altMatch ? altMatch[1] : '';

    if (title) {
      cards.push({
        date, category, title, description, link, imgSrc, imgAlt,
      });
    }
  }
  return cards;
}

function downloadImage(url, filename) {
  const destPath = path.join(IMAGES_DIR, filename);
  if (fs.existsSync(destPath)) {
    console.log(`  Image exists: ${filename}`);
    return true;
  }
  try {
    execSync(`curl -sL -o "${destPath}" "${url}"`, { timeout: 30000 });
    const { size } = fs.statSync(destPath);
    if (size < 500) {
      fs.unlinkSync(destPath);
      console.log(`  Image too small, removed: ${filename}`);
      return false;
    }
    console.log(`  Downloaded: ${filename} (${(size / 1024).toFixed(1)}KB)`);
    return true;
  } catch (e) {
    console.log(`  Failed to download: ${filename}`);
    return false;
  }
}

function buildCardsRelatedHTML(cards) {
  const cardRows = cards.map((card) => {
    const parts = [];

    // Image
    let imgHTML = '';
    if (card.localImg) {
      imgHTML = `<div><img src="./images/${card.localImg}" alt="${card.imgAlt}"></div>`;
    }

    // Content
    const contentParts = [];
    if (card.date) contentParts.push(`<p>${card.date}</p>`);
    if (card.category) contentParts.push(`<p>${card.category}</p>`);
    if (card.title) contentParts.push(`<p><strong>${card.title}</strong></p>`);
    if (card.description) contentParts.push(`<p>${card.description}</p>`);
    if (card.link) {
      const href = card.link.replace('https://www.abbvie.com', '');
      contentParts.push(`<p><a href="${href}">Read story</a></p>`);
    }

    return `<div>${imgHTML}<div>${contentParts.join('')}</div></div>`;
  });

  return `<div class="cards-related">${cardRows.join('')}</div>`;
}

for (const slug of pages) {
  console.log(`\n=== ${slug} ===`);

  const filePath = path.join(CONTENT_DIR, `${slug}.plain.html`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fetch original
  const originalHTML = fetchOriginalHTML(slug);
  if (!originalHTML) {
    console.log('Failed to fetch original');
    continue;
  }

  const cards = extractCards(originalHTML);
  console.log(`Found ${cards.length} cards on original`);

  if (cards.length === 0) {
    console.log('No cards to process');
    continue;
  }

  // Take the first card that has an article link (skip site-wide promo cards)
  const articleCards = cards.filter((c) => c.link && c.link.includes('/who-we-are/our-stories/'));

  console.log(`Article-related cards: ${articleCards.length}`);

  const cardsToUse = articleCards.length > 0 ? articleCards.slice(0, 3) : cards.slice(0, 1);

  // Download images for cards
  for (const card of cardsToUse) {
    if (card.imgSrc) {
      // Create filename from image URL
      const urlParts = card.imgSrc.split('/');
      const imgName = urlParts[urlParts.length - 1].split('?')[0];
      const filename = imgName + (imgName.includes('.') ? '' : '.webp');
      if (downloadImage(card.imgSrc, filename)) {
        card.localImg = filename;
      }
    }
  }

  // Build new cards-related HTML
  const newCardsHTML = buildCardsRelatedHTML(cardsToUse);

  // Replace existing cards-related block
  const cardsStart = content.indexOf('<div class="cards-related">');
  if (cardsStart === -1) {
    console.log('No existing cards-related block to replace');
    continue;
  }

  // Find the end of the outer wrapping div for the cards section
  // Structure: <div><div class="cards-related">...</div></div></div>
  // Need to find the section-level closing divs
  const depth = 0;
  const pos = cardsStart;
  // Find the cards-related closing
  const searchFrom = content.indexOf('cards-related');
  // The cards block ends with </div></div></div> then the next section starts
  const metadataIdx = content.indexOf('class="metadata"', searchFrom);
  if (metadataIdx === -1) {
    console.log('Cannot find metadata block after cards');
    continue;
  }

  // The cards section is: <div><div class="cards-related">..cards..</div></div></div>
  // Find the </div></div> before the metadata section div
  const sectionBefore = content.lastIndexOf('</div>', metadataIdx);
  const sectionStart = content.lastIndexOf('\n<div>', metadataIdx);

  // Replace from cards-related to end of its section
  // Find: <div class="cards-related">...</div></div></div>
  const cardsBlockMatch = content.match(/<div class="cards-related">[\s\S]*?<\/div><\/div><\/div>\s*\n/);
  if (cardsBlockMatch) {
    const oldBlock = cardsBlockMatch[0];
    const newBlock = `${newCardsHTML}</div>\n`;
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Replaced cards-related block with ${cardsToUse.length} card(s)`);
  } else {
    console.log('Could not match cards-related block pattern');
  }
}

console.log('\nDone');
