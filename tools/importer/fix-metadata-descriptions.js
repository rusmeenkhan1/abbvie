#!/usr/bin/env node
/**
 * Fixes missing Description in metadata blocks by scraping the original AbbVie pages.
 * Also fixes any other missing metadata fields.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');

// Find pages missing Description in metadata
function findPagesWithoutDescription() {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.plain.html'));
  const affected = [];

  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('class="metadata"') && !content.includes('<div>Description</div>')) {
      const slug = file.replace('.plain.html', '');
      affected.push({
        file: filePath,
        slug,
        originalUrl: `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`,
      });
    }
  }
  return affected;
}

// Fetch meta description from original page
function fetchMetaDescription(url) {
  try {
    const html = execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
    );

    // Try meta description tag
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);

    if (descMatch) {
      return descMatch[1].replace(/"/g, '&quot;').replace(/&/g, '&#x26;');
    }

    // Try og:description
    const ogDescMatch = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:description["']/i);

    if (ogDescMatch) {
      return ogDescMatch[1].replace(/"/g, '&quot;').replace(/&/g, '&#x26;');
    }

    return null;
  } catch (e) {
    console.error(`  Failed to fetch ${url}: ${e.message}`);
    return null;
  }
}

async function main() {
  const affected = findPagesWithoutDescription();
  console.log(`Found ${affected.length} pages missing Description in metadata\n`);

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < affected.length; i++) {
    const page = affected[i];
    console.log(`[${i+1}/${affected.length}] ${page.slug}`);

    const description = fetchMetaDescription(page.originalUrl);

    if (!description) {
      console.log(`  FAILED: Could not find description`);
      failed++;
      continue;
    }

    // Add Description row to metadata block
    let content = fs.readFileSync(page.file, 'utf8');

    // Find the Title row in metadata and add Description after it
    const titlePattern = '<div><div>Title</div><div>';
    const titleIdx = content.indexOf(titlePattern);

    if (titleIdx === -1) {
      console.log(`  FAILED: Could not find Title in metadata`);
      failed++;
      continue;
    }

    // Find the end of the Title row
    const afterTitle = content.indexOf('</div></div>', titleIdx + titlePattern.length);
    if (afterTitle === -1) {
      console.log(`  FAILED: Could not parse Title row end`);
      failed++;
      continue;
    }

    const insertPoint = afterTitle + '</div></div>'.length;
    const descRow = `<div><div>Description</div><div>${description}</div></div>`;

    content = content.substring(0, insertPoint) + descRow + content.substring(insertPoint);

    fs.writeFileSync(page.file, content, 'utf8');
    console.log(`  FIXED: "${description.substring(0, 60)}..."`);
    fixed++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Failed: ${failed}`);

  // Verify
  let remaining = 0;
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.plain.html'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    if (content.includes('class="metadata"') && !content.includes('<div>Description</div>')) {
      remaining++;
    }
  }
  console.log(`Remaining without Description: ${remaining}`);
}

main().catch(console.error);
