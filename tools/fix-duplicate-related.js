#!/usr/bin/env node
/**
 * Removes duplicate cards-related blocks from pages that have multiple.
 * Keeps only the first cards-related block and its preceding heading.
 * Removes all subsequent cards-related blocks and any Related Content headings
 * that precede them.
 */

/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax */

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

function findBlockEnd(html, startIdx) {
  // Find the end of a cards-related block
  // Structure: <div class="cards-related"><div><div>img</div><div>text</div></div></div>
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

async function fixFile(filename) {
  const filepath = join(STORIES_DIR, filename);
  const html = await readFile(filepath, 'utf-8');

  // Count occurrences first
  const matches = html.match(/<div class="cards-related">/g);
  if (!matches || matches.length <= 1) {
    console.log(`  ${filename}: only ${matches ? matches.length : 0} block(s), skipping`);
    return false;
  }

  console.log(`  ${filename}: found ${matches.length} cards-related blocks`);

  // Find position of first cards-related block
  const firstIdx = html.indexOf('<div class="cards-related">');
  const firstEndIdx = findBlockEnd(html, firstIdx);

  if (firstEndIdx === -1) {
    console.log(`  ${filename}: could not parse first block end, skipping`);
    return false;
  }

  // Find subsequent cards-related blocks
  let cleaned = html;
  let removals = 0;

  const allPositions = [];
  let searchStart = firstEndIdx;
  let nextIdx = cleaned.indexOf('<div class="cards-related">', searchStart);
  while (nextIdx !== -1) {
    allPositions.push(nextIdx);
    searchStart = nextIdx + 1;
    nextIdx = cleaned.indexOf('<div class="cards-related">', searchStart);
  }

  // Process removals from end to start to preserve indices
  for (let i = allPositions.length - 1; i >= 0; i -= 1) {
    const blockStart = allPositions[i];
    const blockEnd = findBlockEnd(cleaned, blockStart);
    if (blockEnd === -1) {
      // skip this block if we can't find its end
      // eslint-disable-next-line no-continue
      continue;
    }

    // Check for preceding heading
    const beforeBlock = cleaned.substring(Math.max(0, blockStart - 200), blockStart);
    let headingStart = blockStart;

    const h5Match = beforeBlock.match(/<h5[^>]*>[^<]*(?:Related|related|You may)[^<]*<\/h5>\s*$/);
    if (h5Match) {
      headingStart = blockStart - (beforeBlock.length - beforeBlock.lastIndexOf(h5Match[0]));
    }

    cleaned = cleaned.substring(0, headingStart) + cleaned.substring(blockEnd);
    removals += 1;
  }

  if (removals > 0) {
    cleaned = cleaned.replace(/\n{3,}/g, '\n');
    await writeFile(filepath, cleaned);
    console.log(`    Removed ${removals} duplicate block(s)`);
    return true;
  }

  return false;
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
