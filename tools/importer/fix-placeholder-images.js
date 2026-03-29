#!/usr/bin/env node
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

for (const file of files) {
  const filePath = path.join(CONTENT_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('icon-search.svg')) {
    affected.push({
      slug: file.replace('.plain.html', ''),
      filePath,
      count: (content.match(/icon-search\.svg/g) || []).length,
    });
  }
}

console.log(`Found ${affected.length} pages with icon-search.svg references\n`);

// For each affected page, fetch the original and map correct images
function fetchOriginal(slug) {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  try {
    return execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 "${url}"`,
      { maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' },
    );
  } catch (e) {
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

for (const page of affected) {
  console.log(`\n=== ${page.slug} (${page.count} placeholders) ===`);

  const originalHtml = fetchOriginal(page.slug);
  if (!originalHtml) {
    console.log('  Could not fetch original page');
    continue;
  }

  let content = fs.readFileSync(page.filePath, 'utf8');

  // Find each icon-search.svg img tag in the migrated content
  const iconImgRegex = /<img src="\.\/images\/icon-search\.svg" alt="([^"]*)">/g;
  let match;
  const replacements = [];

  while ((match = iconImgRegex.exec(content)) !== null) {
    const alt = match[1];
    // Look up this alt text in the surrounding content to find the right image
    const pos = match.index;
    // Get surrounding text context (100 chars before and after)
    const context = content.substring(Math.max(0, pos - 200), pos + match[0].length + 200);
    // Extract the person's name from the text after the image
    const nameMatch = context.match(/icon-search\.svg"[^>]*>\s*([^<]+)/);
    const personName = nameMatch ? nameMatch[1].trim() : '';

    replacements.push({
      fullMatch: match[0],
      alt,
      personName,
      index: match.index,
    });
  }

  console.log(`  Found ${replacements.length} placeholder images`);

  // Extract all Scene7 image URLs from original for matching
  const scene7Pattern = /https:\/\/abbvie\.scene7\.com\/is\/image\/abbviecorp\/([^?"'\s]+)/g;
  const scene7Images = [];
  let s7match;
  while ((s7match = scene7Pattern.exec(originalHtml)) !== null) {
    scene7Images.push({ url: s7match[0], name: s7match[1] });
  }

  // For each replacement, try to find and download the correct image
  for (const rep of replacements) {
    console.log(`\n  Placeholder: alt="${rep.alt}", context: "${rep.personName}"`);

    // Try to find matching Scene7 image
    // For photo carousels, they usually have sequential names
    let found = false;

    for (const s7 of scene7Images) {
      // Skip images we already have
      const existingFile = `${s7.name}.webp`;
      if (fs.existsSync(path.join(IMAGES_DIR, existingFile))) continue;

      // Check if this Scene7 image is used in the original with matching context
      // Build Scene7 URL with webp format
      const downloadUrl = `${s7.url}?fmt=webp`;
      const filename = `${s7.name}.webp`;

      // Check if this image appears near similar alt/context in original
      const s7Regex = new RegExp(`src=["'][^"']*${s7.name.replace(/[-()]/g, '[-()]')}[^"']*["'][^>]*alt=["']([^"']*)["']`, 'i');
      const altMatch = originalHtml.match(s7Regex);
      const reverseRegex = new RegExp(`alt=["']([^"']*)["'][^>]*src=["'][^"']*${s7.name.replace(/[-()]/g, '[-()]')}[^"']*["']`, 'i');
      const reverseMatch = originalHtml.match(reverseRegex);

      const origAlt = (altMatch && altMatch[1]) || (reverseMatch && reverseMatch[1]) || '';

      // Match by empty alt (many placeholder images had empty alt)
      if (rep.alt === '' && origAlt === '' && s7.name.includes('photo_carousel')) {
        if (downloadImage(downloadUrl, filename)) {
          content = content.replace(
            rep.fullMatch,
            `<img src="./images/${filename}" alt="${rep.alt}">`,
          );
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Try direct Scene7 URL construction based on known patterns
      // Many of these are photo carousel images with sequential numbering
      const carouselPatterns = scene7Images
        .filter((s7) => s7.name.includes('photo_carousel') || s7.name.includes('_photo_'))
        .map((s7) => s7.name);

      for (const name of carouselPatterns) {
        const filename = `${name}.webp`;
        if (fs.existsSync(path.join(IMAGES_DIR, filename))) continue;

        const downloadUrl = `https://abbvie.scene7.com/is/image/abbviecorp/${name}?fmt=webp`;
        if (downloadImage(downloadUrl, filename)) {
          content = content.replace(
            rep.fullMatch,
            `<img src="./images/${filename}" alt="${rep.alt}">`,
          );
          found = true;
          break;
        }
      }
    }

    if (!found) {
      console.log('  Could not find replacement image');
    }
  }

  fs.writeFileSync(page.filePath, content, 'utf8');
}

// Verify remaining
let remaining = 0;
for (const file of files) {
  const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const count = (content.match(/icon-search\.svg/g) || []).length;
  if (count > 0) {
    remaining += count;
    console.log(`  Still has ${count}: ${file.replace('.plain.html', '')}`);
  }
}
console.log(`\n=== Remaining icon-search.svg references: ${remaining} ===`);
