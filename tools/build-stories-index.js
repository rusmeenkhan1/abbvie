#!/usr/bin/env node
/**
 * Build a query-index.json from all story .plain.html files.
 * Extracts metadata (title, description, category, image, publishedDate, readTime)
 * from each story page to enable dynamic Related Content.
 */

/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const STORIES_DIR = join(process.cwd(), 'content', 'who-we-are', 'our-stories');
const OUTPUT_FILE = join(process.cwd(), 'content', 'who-we-are', 'our-stories', 'query-index.json');

function decodeEntities(str) {
  return str
    .replace(/&#x26;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function processFile(filename) {
  const filepath = join(STORIES_DIR, filename);
  const html = await readFile(filepath, 'utf-8');
  const slug = filename.replace('.plain.html', '');
  const path = `/who-we-are/our-stories/${slug}`;

  // Extract from hero-article block
  const heroMatch = html.match(/<div class="hero-article">([\s\S]*?)<\/div><\/div><\/div>/);
  if (!heroMatch) return null;

  // Extract hero image (first img in hero)
  const heroImgMatch = html.match(/<div class="hero-article">[\s\S]*?<img\s+src="([^"]+)"/);
  const image = heroImgMatch ? heroImgMatch[1] : '';

  let category = '';
  let readTime = '';
  let title = '';
  let description = '';

  // Extract category and read time
  const catReadMatch = html.match(/<div class="hero-article">[\s\S]*?<div><div>([^<]+)<\/div><div>(\d+ Minute Read)<\/div><\/div>/);
  if (catReadMatch) {
    category = catReadMatch[1].trim();
    readTime = catReadMatch[2].trim();
  }

  // Title: h1 inside hero
  const titleMatch = html.match(/<div class="hero-article">[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (titleMatch) {
    title = decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim());
  }

  // Description: the last row text in hero (after h1 row)
  const descMatch = html.match(/<\/h1><\/div><\/div><div><div>([\s\S]*?)<\/div><\/div><\/div><\/div>/);
  if (descMatch) {
    description = decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim());
  }

  // Extract published date from metadata block
  let publishedDate = '';
  const dateMatch = html.match(/<div>Published Date<\/div><div>([^<]+)<\/div>/);
  if (dateMatch) {
    publishedDate = dateMatch[1].trim();
  }

  // Resolve image path relative to content
  let imagePath = image;
  if (image.startsWith('./')) {
    imagePath = `/who-we-are/our-stories/${image.slice(2)}`;
  } else if (image.startsWith('/')) {
    imagePath = image;
  }

  if (!title) return null;

  return {
    path,
    title,
    description,
    category,
    image: imagePath,
    publishedDate,
    readTime,
  };
}

async function main() {
  const files = await readdir(STORIES_DIR);
  const htmlFiles = files.filter((f) => f.endsWith('.plain.html'));

  const entries = [];
  for (const file of htmlFiles) {
    try {
      const entry = await processFile(file);
      if (entry) entries.push(entry);
    } catch (e) {
      console.error(`Error processing ${file}: ${e.message}`);
    }
  }

  // Sort by published date (newest first)
  entries.sort((a, b) => {
    const da = a.publishedDate ? new Date(a.publishedDate) : new Date(0);
    const db = b.publishedDate ? new Date(b.publishedDate) : new Date(0);
    return db - da;
  });

  const index = {
    total: entries.length,
    offset: 0,
    limit: entries.length,
    data: entries,
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(index, null, 2));
  console.log(`Generated query-index.json with ${entries.length} entries`);

  // Print category breakdown
  const categories = {};
  entries.forEach((e) => {
    const cat = e.category || '(none)';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  console.log('\nCategory breakdown:');
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
}

main();
