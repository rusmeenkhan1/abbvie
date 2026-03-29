#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Fix images that were incorrectly downloaded as icon-search.svg.
 * These should be actual Scene7 photos. Re-downloads from source.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

// Find all pages with icon-search.svg references
const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.plain.html'));
const affected = [];

files.forEach((file) => {
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('icon-search.svg')) {
    affected.push({
      slug: file.replace('.plain.html', ''),
      filePath,
      count: (content.match(/icon-search\.svg/g) || []).length,
    });
  }
});

console.log(`Found ${affected.length} pages with icon-search.svg references\n`);

// For each affected page, fetch the original and map correct images
function fetchOriginal(slug) {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  try {
    return execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 "${url}"`,
      { maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' },
    );
  } catch (_e) {
    return null;
  }
}

function downloadImage(url, filename) {
  const outPath = path.join(IMAGES_DIR, filename);
  try {
    execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 -o "${outPath}" "${url}"`,
      { timeout: 60000 },
    );
    const stats = fs.statSync(outPath);
    if (stats.size < 100) {
      console.log(`  WARNING: Downloaded file too small (${stats.size} bytes), might be error`);
      fs.unlinkSync(outPath);
      return false;
    }
    console.log(`  Downloaded: ${filename} (${stats.size} bytes)`);
    return true;
  } catch (e) {
    console.log(`  FAILED: ${e.message}`);
    return false;
  }
}

function tryScene7Match(s7, rep, originalHtml, content) {
  const escapedName = s7.name.replace(/[-()]/g, '[-()]');
  const s7Regex = new RegExp(
    `src=["'][^"']*${escapedName}[^"']*["'][^>]*alt=["']([^"']*)["']`,
    'i',
  );
  const altMatch = originalHtml.match(s7Regex);
  const reverseRegex = new RegExp(
    `alt=["']([^"']*)["'][^>]*src=["'][^"']*${escapedName}[^"']*["']`,
    'i',
  );
  const reverseMatch = originalHtml.match(reverseRegex);

  const origAlt = (altMatch && altMatch[1])
    || (reverseMatch && reverseMatch[1])
    || '';

  const filename = `${s7.name}.webp`;

  // Match by empty alt (many placeholder images had empty alt)
  if (rep.alt === '' && origAlt === '' && s7.name.includes('photo_carousel')) {
    const downloadUrl = `${s7.url}?fmt=webp`;
    if (downloadImage(downloadUrl, filename)) {
      return content.replace(
        rep.fullMatch,
        `<img src="./images/${filename}" alt="${rep.alt}">`,
      );
    }
  }
  return null;
}

function processReplacements(replacements, scene7Images, originalHtml, content) {
  let updatedContent = content;

  replacements.forEach((rep) => {
    console.log(
      `\n  Placeholder: alt="${rep.alt}", context: "${rep.personName}"`,
    );

    // Try to find matching Scene7 image
    let found = false;

    scene7Images.some((s7) => {
      const existingFile = `${s7.name}.webp`;
      if (fs.existsSync(path.join(IMAGES_DIR, existingFile))) {
        return false; // continue to next
      }

      const result = tryScene7Match(s7, rep, originalHtml, updatedContent);
      if (result) {
        updatedContent = result;
        found = true;
        return true; // break
      }
      return false; // continue
    });

    if (!found) {
      // Try direct Scene7 URL construction based on known patterns
      const carouselPatterns = scene7Images
        .filter((s7) => s7.name.includes('photo_carousel')
          || s7.name.includes('_photo_'))
        .map((s7) => s7.name);

      carouselPatterns.some((name) => {
        const filename = `${name}.webp`;
        if (fs.existsSync(path.join(IMAGES_DIR, filename))) {
          return false; // continue to next
        }

        const downloadUrl = 'https://abbvie.scene7.com/is/image/abbviecorp/'
          + `${name}?fmt=webp`;
        if (downloadImage(downloadUrl, filename)) {
          updatedContent = updatedContent.replace(
            rep.fullMatch,
            `<img src="./images/${filename}" alt="${rep.alt}">`,
          );
          found = true;
          return true; // break
        }
        return false; // continue
      });
    }

    if (!found) {
      console.log('  Could not find replacement image');
    }
  });

  return updatedContent;
}

function extractReplacements(content) {
  const iconImgRegex = /<img src="\.\/images\/icon-search\.svg" alt="([^"]*)">/g;
  const replacements = [];

  let match = iconImgRegex.exec(content);
  while (match !== null) {
    const alt = match[1];
    const pos = match.index;
    const context = content.substring(
      Math.max(0, pos - 200),
      pos + match[0].length + 200,
    );
    const nameMatch = context.match(
      /icon-search\.svg"[^>]*>\s*([^<]+)/,
    );
    const personName = nameMatch ? nameMatch[1].trim() : '';

    replacements.push({
      fullMatch: match[0],
      alt,
      personName,
      index: match.index,
    });

    match = iconImgRegex.exec(content);
  }

  return replacements;
}

function extractScene7Images(originalHtml) {
  const scene7Pattern = /https:\/\/abbvie\.scene7\.com\/is\/image\/abbviecorp\/([^?"'\s]+)/g;
  const scene7Images = [];

  let s7match = scene7Pattern.exec(originalHtml);
  while (s7match !== null) {
    scene7Images.push({ url: s7match[0], name: s7match[1] });
    s7match = scene7Pattern.exec(originalHtml);
  }

  return scene7Images;
}

affected.forEach((page) => {
  console.log(`\n=== ${page.slug} (${page.count} placeholders) ===`);

  const originalHtml = fetchOriginal(page.slug);
  if (!originalHtml) {
    console.log('  Could not fetch original page');
    return;
  }

  let content = fs.readFileSync(page.filePath, 'utf8');

  const replacements = extractReplacements(content);
  console.log(`  Found ${replacements.length} placeholder images`);

  const scene7Images = extractScene7Images(originalHtml);

  content = processReplacements(
    replacements,
    scene7Images,
    originalHtml,
    content,
  );

  fs.writeFileSync(page.filePath, content, 'utf8');
});

// Verify remaining
let remaining = 0;
files.forEach((file) => {
  const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const count = (content.match(/icon-search\.svg/g) || []).length;
  if (count > 0) {
    remaining += count;
    console.log(`  Still has ${count}: ${file.replace('.plain.html', '')}`);
  }
});
console.log(`\n=== Remaining icon-search.svg references: ${remaining} ===`);
