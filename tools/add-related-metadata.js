#!/usr/bin/env node
/**
 * Adds "Related Content" metadata to story .plain.html files
 * based on existing cards-related block content.
 * Only the first related story link is used (matching original site behavior).
 */

/* eslint-disable no-console */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const STORIES_DIR = join(process.cwd(), 'content', 'who-we-are', 'our-stories');

async function processFile(filepath) {
  const html = await readFile(filepath, 'utf-8');

  // Skip files without cards-related block
  if (!html.includes('class="cards-related"')) return null;

  // Extract the first valid href from cards-related block
  const cardsMatch = html.match(/<div class="cards-related">([\s\S]*?)(?=<\/div>\s*<\/div>\s*(?:<div>|$))/);
  if (!cardsMatch) return null;

  const cardsHtml = cardsMatch[1];
  const hrefs = [...cardsHtml.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => h !== '#' && h.length > 1);

  if (hrefs.length === 0) return null;

  // Use the first valid story link (normalize path)
  const relatedPath = hrefs[0]
    .replace(/^\/content\/abbvie-com2\/us\/en/, '') // normalize legacy AEM paths
    .replace(/\.html$/, ''); // remove .html extension for clean metadata

  // Check if metadata already has "Related Content"
  if (html.includes('<div>Related Content</div>')) {
    return { filepath, relatedPath, action: 'already-exists' };
  }

  // Find the metadata block and inject the Related Content row
  const metadataPattern = /(<div class="metadata">)([\s\S]*?)(<\/div>\s*<\/div>)\s*$/;
  const metaMatch = html.match(metadataPattern);
  if (!metaMatch) return { filepath, relatedPath, action: 'no-metadata-block' };

  // Insert Related Content row before the closing of metadata block
  const relatedRow = `<div><div>Related Content</div><div>${relatedPath}</div></div>`;
  const lastDivClose = html.lastIndexOf('</div></div>');
  if (lastDivClose === -1) return { filepath, relatedPath, action: 'no-closing-divs' };

  const updatedHtml = `${html.slice(0, lastDivClose)}${relatedRow}</div></div>`;

  await writeFile(filepath, updatedHtml);
  return { filepath, relatedPath, action: 'added' };
}

async function main() {
  const files = await readdir(STORIES_DIR);
  const htmlFiles = files.filter((f) => f.endsWith('.plain.html'));

  const results = { added: [], skipped: [], errors: [] };

  await Promise.all(htmlFiles.map(async (file) => {
    const filepath = join(STORIES_DIR, file);
    try {
      const result = await processFile(filepath);
      if (!result) {
        results.skipped.push(file);
      } else if (result.action === 'added') {
        results.added.push({ file, path: result.relatedPath });
      } else {
        results.skipped.push(`${file} (${result.action})`);
      }
    } catch (e) {
      results.errors.push(`${file}: ${e.message}`);
    }
  }));

  console.log(`\nAdded Related Content metadata to ${results.added.length} files:`);
  results.added.sort((a, b) => a.file.localeCompare(b.file));
  results.added.forEach(({ file, path }) => {
    console.log(`  ${file} → ${path}`);
  });

  if (results.errors.length > 0) {
    console.log(`\nErrors (${results.errors.length}):`);
    results.errors.forEach((e) => console.log(`  ${e}`));
  }

  console.log(`\nSkipped: ${results.skipped.length} files (no cards-related or already has metadata)`);
}

main();
