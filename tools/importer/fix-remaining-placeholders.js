#!/usr/bin/env node
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
    execSync(`curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 -o "${outPath}" "${url}"`, { timeout: 60000 });
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

// Process each affected page
const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.plain.html'));

for (const file of files) {
  const filePath = path.join(CONTENT_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('icon-search.svg')) continue;

  const slug = file.replace('.plain.html', '');
  console.log(`\nProcessing: ${slug}`);

  const originalHtml = fetchOriginal(slug);
  if (!originalHtml) {
    console.log('  Could not fetch original');
    continue;
  }

  // Strip header from original
  let body = originalHtml;
  const headerEnd = originalHtml.indexOf('</header>');
  if (headerEnd > -1) body = originalHtml.substring(headerEnd + 9);

  // Extract ALL Scene7 image URLs from original body
  const scene7Matches = [...body.matchAll(/(?:src|data-src)=["'](https:\/\/abbvie\.scene7\.com\/is\/(?:image|content)\/abbviecorp\/([^?"'\s]+))[^"']*["']/gi)];
  const originalImages = [];
  for (const m of scene7Matches) {
    const fullUrl = m[1];
    const name = m[2];
    // Get alt text
    const imgTag = body.substring(Math.max(0, m.index - 200), m.index + m[0].length + 200);
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    originalImages.push({ fullUrl, name, alt });
  }

  // Also check srcset and data-srcset
  const srcsetMatches = [...body.matchAll(/(?:srcset|data-srcset)=["']([^"']+)["']/gi)];
  for (const m of srcsetMatches) {
    const urls = m[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
    for (const url of urls) {
      const scene7Match = url.match(/abbvie\.scene7\.com\/is\/(?:image|content)\/abbviecorp\/([^?"'\s]+)/);
      if (scene7Match) {
        const name = scene7Match[1];
        if (!originalImages.find((i) => i.name === name)) {
          originalImages.push({ fullUrl: url, name, alt: '' });
        }
      }
    }
  }

  console.log(`  Found ${originalImages.length} Scene7 images in original body`);

  // Find icon-search.svg references in migrated content with surrounding context
  // Use a different regex that handles HTML entities in alt text
  const iconPattern = /<img src="\.\/images\/icon-search\.svg" alt="([^"]*)"[^>]*>/g;
  let match;
  let fixCount = 0;

  while ((match = iconPattern.exec(content)) !== null) {
    const fullTag = match[0];
    const alt = match[1]
      .replace(/&#x27;/g, "'")
      .replace(/&#x26;/g, '&')
      .replace(/&amp;/g, '&');

    // Get context (text after the image tag)
    const afterImg = content.substring(match.index + fullTag.length, match.index + fullTag.length + 300);
    const contextText = afterImg.replace(/<[^>]+>/g, ' ').trim().substring(0, 100);

    console.log(`  Placeholder: alt="${alt}" context: "${contextText.substring(0, 60)}"`);

    // Try to match with original by alt text
    let matchedImage = null;

    if (alt && alt.length > 3) {
      matchedImage = originalImages.find((oi) => oi.alt && oi.alt.toLowerCase() === alt.toLowerCase());
    }

    if (!matchedImage) {
      // Try to match by position - find unused Scene7 images that aren't already downloaded
      for (const oi of originalImages) {
        const localFile = `${oi.name}.webp`;
        const localFileSvg = `${oi.name}.svg`;
        if (!fs.existsSync(path.join(IMAGES_DIR, localFile))
            && !fs.existsSync(path.join(IMAGES_DIR, localFileSvg))
            && !oi.name.includes('logo')
            && !oi.name.includes('icon')
            && !oi.name.includes('abbvie-logo')) {
          matchedImage = oi;
          break;
        }
      }
    }

    if (matchedImage) {
      // Download the image
      const isContent = matchedImage.fullUrl.includes('/is/content/');
      const ext = isContent ? 'svg' : 'webp';
      const filename = `${matchedImage.name}.${ext}`;
      const downloadUrl = isContent
        ? matchedImage.fullUrl
        : `https://abbvie.scene7.com/is/image/abbviecorp/${matchedImage.name}`;

      if (fs.existsSync(path.join(IMAGES_DIR, filename))) {
        // Already downloaded, just update reference
        content = content.replace(fullTag, `<img src="./images/${filename}" alt="${match[1]}">`);
        fixCount++;
        console.log(`  -> Using existing: ${filename}`);
        // Remove from list to avoid reuse
        originalImages.splice(originalImages.indexOf(matchedImage), 1);
      } else if (downloadImage(downloadUrl, filename)) {
        content = content.replace(fullTag, `<img src="./images/${filename}" alt="${match[1]}">`);
        fixCount++;
        console.log(`  -> Downloaded: ${filename}`);
        originalImages.splice(originalImages.indexOf(matchedImage), 1);
      } else {
        console.log(`  -> Download failed for ${filename}`);
      }
    } else {
      console.log('  -> No matching image found');
    }
  }

  if (fixCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  Fixed ${fixCount} placeholder(s)`);
  }
}

// Final count
let totalRemaining = 0;
for (const file of files) {
  const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const count = (content.match(/icon-search\.svg/g) || []).length;
  if (count > 0) {
    totalRemaining += count;
    console.log(`  Still has ${count}: ${file.replace('.plain.html', '')}`);
  }
}
console.log(`\n=== Total remaining icon-search.svg: ${totalRemaining} ===`);
