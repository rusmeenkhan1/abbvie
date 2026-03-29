#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Fix remaining icon-search.svg placeholders by fetching the correct images
 * from the original AbbVie pages.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

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
    if (stats.size < 500) {
      // Check if it's an error response
      const content = fs.readFileSync(outPath, 'utf8');
      if (content.includes('Error') || content.includes('error')) {
        fs.unlinkSync(outPath);
        return false;
      }
    }
    return stats.size > 500;
  } catch (e) {
    return false;
  }
}

function extractScene7Images(body) {
  const re = /(?:src|data-src)=["'](https:\/\/abbvie\.scene7\.com\/is\/(?:image|content)\/abbviecorp\/([^?"'\s]+))[^"']*["']/gi;
  const matches = [...body.matchAll(re)];
  const images = [];
  matches.forEach((m) => {
    const fullUrl = m[1];
    const name = m[2];
    // Get alt text
    const start = Math.max(0, m.index - 200);
    const end = m.index + m[0].length + 200;
    const imgTag = body.substring(start, end);
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    images.push({ fullUrl, name, alt });
  });
  return images;
}

function addSrcsetImages(body, originalImages) {
  const srcsetRe = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  const matches = [...body.matchAll(srcsetRe)];
  matches.forEach((m) => {
    const urls = m[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
    urls.forEach((url) => {
      const scene7Match = url.match(
        /abbvie\.scene7\.com\/is\/(?:image|content)\/abbviecorp\/([^?"'\s]+)/,
      );
      if (scene7Match) {
        const name = scene7Match[1];
        if (!originalImages.find((i) => i.name === name)) {
          originalImages.push({ fullUrl: url, name, alt: '' });
        }
      }
    });
  });
}

function tryMatchByAlt(alt, originalImages) {
  if (alt && alt.length > 3) {
    return originalImages.find(
      (oi) => oi.alt && oi.alt.toLowerCase() === alt.toLowerCase(),
    );
  }
  return null;
}

function tryMatchByPosition(originalImages) {
  let found = null;
  originalImages.some((oi) => {
    const localFile = `${oi.name}.webp`;
    const localFileSvg = `${oi.name}.svg`;
    const alreadyExists = fs.existsSync(path.join(IMAGES_DIR, localFile))
      || fs.existsSync(path.join(IMAGES_DIR, localFileSvg));
    const isUtility = oi.name.includes('logo')
      || oi.name.includes('icon')
      || oi.name.includes('abbvie-logo');
    if (!alreadyExists && !isUtility) {
      found = oi;
      return true;
    }
    return false;
  });
  return found;
}

function processMatch(fullMatch, originalImages) {
  const fullTag = fullMatch[0];
  const alt = fullMatch[1]
    .replace(/&#x27;/g, "'")
    .replace(/&#x26;/g, '&')
    .replace(/&amp;/g, '&');

  console.log(
    `  Placeholder: alt="${alt}" context: (position ${fullMatch.index})`,
  );

  let matchedImage = tryMatchByAlt(alt, originalImages);
  if (!matchedImage) {
    matchedImage = tryMatchByPosition(originalImages);
  }
  return { fullTag, matchedImage, altRaw: fullMatch[1] };
}

function applyFix(content, fullTag, matchedImage, altRaw, originalImages) {
  const isContent = matchedImage.fullUrl.includes('/is/content/');
  const ext = isContent ? 'svg' : 'webp';
  const filename = `${matchedImage.name}.${ext}`;
  const dlUrl = isContent
    ? matchedImage.fullUrl
    : `https://abbvie.scene7.com/is/image/abbviecorp/${matchedImage.name}`;

  const newTag = `<img src="./images/${filename}" alt="${altRaw}">`;
  if (fs.existsSync(path.join(IMAGES_DIR, filename))) {
    console.log(`  -> Using existing: ${filename}`);
    originalImages.splice(originalImages.indexOf(matchedImage), 1);
    return { content: content.replace(fullTag, newTag), fixed: true };
  }
  if (downloadImage(dlUrl, filename)) {
    console.log(`  -> Downloaded: ${filename}`);
    originalImages.splice(originalImages.indexOf(matchedImage), 1);
    return { content: content.replace(fullTag, newTag), fixed: true };
  }
  console.log(`  -> Download failed for ${filename}`);
  return { content, fixed: false };
}

// Process each affected page
const files = fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.plain.html'));

files.forEach((file) => {
  const filePath = path.join(CONTENT_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('icon-search.svg')) return;

  const slug = file.replace('.plain.html', '');
  console.log(`\nProcessing: ${slug}`);

  const originalHtml = fetchOriginal(slug);
  if (!originalHtml) {
    console.log('  Could not fetch original');
    return;
  }

  // Strip header from original
  let body = originalHtml;
  const headerEnd = originalHtml.indexOf('</header>');
  if (headerEnd > -1) body = originalHtml.substring(headerEnd + 9);

  // Extract ALL Scene7 image URLs from original body
  const originalImages = extractScene7Images(body);

  // Also check srcset and data-srcset
  addSrcsetImages(body, originalImages);

  console.log(
    `  Found ${originalImages.length} Scene7 images in original body`,
  );

  // Find icon-search.svg references in migrated content
  const iconPattern = /<img src="\.\/images\/icon-search\.svg" alt="([^"]*)"[^>]*>/g;
  let fixCount = 0;

  // Collect all matches first (avoid regex + replace interaction)
  const allMatches = [...content.matchAll(iconPattern)];

  allMatches.forEach((m) => {
    const { fullTag, matchedImage, altRaw } = processMatch(
      m,
      originalImages,
    );

    if (matchedImage) {
      const result = applyFix(
        content,
        fullTag,
        matchedImage,
        altRaw,
        originalImages,
      );
      content = result.content;
      if (result.fixed) {
        fixCount += 1;
      }
    } else {
      console.log('  -> No matching image found');
    }
  });

  if (fixCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  Fixed ${fixCount} placeholder(s)`);
  }
});

// Final count
let totalRemaining = 0;
files.forEach((file) => {
  const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const count = (content.match(/icon-search\.svg/g) || []).length;
  if (count > 0) {
    totalRemaining += count;
    console.log(
      `  Still has ${count}: ${file.replace('.plain.html', '')}`,
    );
  }
});
console.log(`\n=== Total remaining icon-search.svg: ${totalRemaining} ===`);
