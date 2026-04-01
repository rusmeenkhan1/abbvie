#!/usr/bin/env node
/**
 * Removes duplicate cards-related blocks from pages that have multiple.
 * Keeps only the first cards-related block and its preceding heading.
 * Removes all subsequent cards-related blocks and any Related Content headings
 * that precede them.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const STORIES_DIR = join(process.cwd(), 'content', 'who-we-are', 'our-stories');

const FILES = [
  'abbvie-research-collaborative.plain.html',
  'celebrating-abbvies-2025-working-parents-caregivers.plain.html',
  'digital-science-lab.plain.html',
  'new-microsite-clinic-brings-healthcare-to-chicago-southwest-side.plain.html',
  'specialized-research-in-chaotic-systems-sparcs.plain.html',
];

async function fixFile(filename) {
  const filepath = join(STORIES_DIR, filename);
  const html = await readFile(filepath, 'utf-8');

  // Split into sections (top-level divs)
  // The page structure is: <div>section1</div>\n<div>section2</div>\n...
  // The related content section contains the cards-related blocks

  // Find and process the section containing cards-related
  // Strategy: find all cards-related blocks, keep the first, remove the rest
  // Also remove any "Related Content" / "You may also like" headings
  // that precede duplicate blocks

  // Count occurrences first
  const matches = html.match(/<div class="cards-related">/g);
  if (!matches || matches.length <= 1) {
    console.log(`  ${filename}: only ${matches ? matches.length : 0} block(s), skipping`);
    return false;
  }

  console.log(`  ${filename}: found ${matches.length} cards-related blocks`);

  // Find the section that contains cards-related blocks
  // It's a top-level <div> that contains <div class="cards-related">
  // We need to find this section and clean it up

  // Parse the section containing cards-related content
  // Strategy: find the first cards-related block, then remove everything after it
  // up to the closing of the section (but before the metadata section)

  // Find position of first cards-related block
  const firstIdx = html.indexOf('<div class="cards-related">');
  // Find its closing - it's a block with rows: <div class="cards-related"><div>..row..</div></div>
  const firstEndIdx = findBlockEnd(html, firstIdx);

  if (firstEndIdx === -1) {
    console.log(`  ${filename}: could not parse first block end, skipping`);
    return false;
  }

  // Find subsequent cards-related blocks and any headings between them
  let cleaned = html;
  let removals = 0;

  // Remove all cards-related blocks except the first one
  // Work backwards to preserve indices
  const allPositions = [];
  let searchStart = firstEndIdx;
  while (true) {
    const nextIdx = cleaned.indexOf('<div class="cards-related">', searchStart);
    if (nextIdx === -1) break;
    allPositions.push(nextIdx);
    searchStart = nextIdx + 1;
  }

  // Process removals from end to start to preserve indices
  for (let i = allPositions.length - 1; i >= 0; i -= 1) {
    const blockStart = allPositions[i];
    const blockEnd = findBlockEnd(cleaned, blockStart);
    if (blockEnd === -1) continue;

    // Check for preceding heading (h5 or p with "Related Content" / "You may also like")
    const beforeBlock = cleaned.substring(Math.max(0, blockStart - 200), blockStart);
    let headingStart = blockStart;

    // Check for <h5>Related Content</h5> or <h5>You may also like</h5>
    const h5Match = beforeBlock.match(/<h5[^>]*>[^<]*(?:Related|related|You may)[^<]*<\/h5>\s*$/);
    if (h5Match) {
      headingStart = blockStart - (beforeBlock.length - beforeBlock.lastIndexOf(h5Match[0]));
    }

    // Remove the block and its heading
    cleaned = cleaned.substring(0, headingStart) + cleaned.substring(blockEnd);
    removals += 1;
  }

  if (removals > 0) {
    // Clean up any empty lines left behind
    cleaned = cleaned.replace(/\n{3,}/g, '\n');
    await writeFile(filepath, cleaned);
    console.log(`    Removed ${removals} duplicate block(s)`);
    return true;
  }

  return false;
}

function findBlockEnd(html, startIdx) {
  // Find the end of a cards-related block
  // Structure: <div class="cards-related"><div><div>img</div><div>text</div></div></div>
  // We need to find the matching closing </div> for the cards-related div

  let depth = 0;
  let i = startIdx;
  while (i < html.length) {
    if (html.substring(i, i + 4) === '<div') {
      depth += 1;
      i += 4;
    } else if (html.substring(i, i + 6) === '</div>') {
      depth -= 1;
      if (depth === 0) {
        return i + 6;
      }
      i += 6;
    } else {
      i += 1;
    }
  }
  return -1;
}

async function main() {
  console.log('Fixing duplicate cards-related blocks:\n');
  let fixed = 0;
  for (const file of FILES) {
    const result = await fixFile(file);
    if (result) fixed += 1;
  }
  console.log(`\nDone. Fixed ${fixed} of ${FILES.length} files.`);
}

main();
