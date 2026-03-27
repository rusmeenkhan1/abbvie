#!/usr/bin/env node
/**
 * Fixes empty src="" image attributes in imported content files.
 * For each affected page, scrapes the original AbbVie page to find
 * matching images by alt text and downloads them locally.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

// Find all pages with empty src="" attributes
function findPagesWithEmptySrc() {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.plain.html'));
  const affected = [];

  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = [...content.matchAll(/<img src="" alt="([^"]*)"/g)];

    if (matches.length > 0) {
      const slug = file.replace('.plain.html', '');
      affected.push({
        file: filePath,
        slug,
        originalUrl: `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`,
        emptyImages: matches.map(m => ({
          fullMatch: m[0],
          alt: m[1],
        })),
      });
    }
  }
  return affected;
}

// Download file with redirect support
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const cleanUrl = url.replace(/&#x26;/g, '&').replace(/&amp;/g, '&');
    const protocol = cleanUrl.startsWith('https') ? https : require('http');

    const request = protocol.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      timeout: 30000,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(destPath); });
      fileStream.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Timeout')); });
  });
}

// Generate clean filename from URL
function urlToFilename(url) {
  try {
    const u = new URL(url.replace(/&#x26;/g, '&'));
    const scene7Match = u.pathname.match(/\/is\/(?:image|content)\/abbviecorp\/(.+)/);
    if (scene7Match) {
      let name = scene7Match[1].replace(/\//g, '-');
      const fmt = u.searchParams.get('fmt');
      if (fmt) return `${name}.${fmt}`;
      if (u.pathname.includes('/is/content/')) return `${name}.svg`;
      return `${name}.webp`;
    }
    // DAM path
    const damMatch = u.pathname.match(/\/content\/dam\/.*\/([^/]+)$/);
    if (damMatch) {
      return decodeURIComponent(damMatch[1]);
    }
    let name = u.pathname.split('/').pop() || 'image';
    if (!name.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) name += '.webp';
    return name;
  } catch (e) {
    return `image-${Date.now()}.webp`;
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

// Use curl to fetch page HTML and extract image data
function fetchPageImages(url) {
  try {
    const html = execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
    );

    // Extract all img tags with src and alt
    const imgMatches = [...html.matchAll(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*\balt=["']([^"']*)["'][^>]*>/gi)];
    const imgMatchesReverse = [...html.matchAll(/<img[^>]*\balt=["']([^"']*)["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];

    // Also look for data-src, srcset, and background images
    const dataSrcMatches = [...html.matchAll(/<img[^>]*\bdata-src=["']([^"']+)["'][^>]*\balt=["']([^"']*)["'][^>]*>/gi)];
    const dataSrcMatchesReverse = [...html.matchAll(/<img[^>]*\balt=["']([^"']*)["'][^>]*\bdata-src=["']([^"']+)["'][^>]*>/gi)];

    // Srcset patterns
    const srcsetMatches = [...html.matchAll(/<(?:img|source)[^>]*\bsrcset=["']([^"']+)["'][^>]*\balt=["']([^"']*)["'][^>]*>/gi)];
    const srcsetMatchesReverse = [...html.matchAll(/<(?:img|source)[^>]*\balt=["']([^"']*)["'][^>]*\bsrcset=["']([^"']+)["'][^>]*>/gi)];

    const images = new Map(); // alt -> src

    for (const m of imgMatches) {
      const src = m[1], alt = m[2];
      if (src && !src.startsWith('data:')) images.set(alt, src);
    }
    for (const m of imgMatchesReverse) {
      const alt = m[1], src = m[2];
      if (src && !src.startsWith('data:') && !images.has(alt)) images.set(alt, src);
    }
    for (const m of dataSrcMatches) {
      const src = m[1], alt = m[2];
      if (src && !src.startsWith('data:') && !images.has(alt)) images.set(alt, src);
    }
    for (const m of dataSrcMatchesReverse) {
      const alt = m[1], src = m[2];
      if (src && !src.startsWith('data:') && !images.has(alt)) images.set(alt, src);
    }
    for (const m of srcsetMatches) {
      const srcset = m[1], alt = m[2];
      const firstSrc = srcset.split(',')[0].trim().split(/\s+/)[0];
      if (firstSrc && !firstSrc.startsWith('data:') && !images.has(alt)) images.set(alt, firstSrc);
    }
    for (const m of srcsetMatchesReverse) {
      const alt = m[1], srcset = m[2];
      const firstSrc = srcset.split(',')[0].trim().split(/\s+/)[0];
      if (firstSrc && !firstSrc.startsWith('data:') && !images.has(alt)) images.set(alt, firstSrc);
    }

    return images;
  } catch (e) {
    console.error(`  Failed to fetch ${url}: ${e.message}`);
    return new Map();
  }
}

async function main() {
  const affected = findPagesWithEmptySrc();
  console.log(`Found ${affected.length} pages with empty src attributes`);

  let totalFixed = 0;
  let totalFailed = 0;
  const allFailed = [];
  const existingFiles = new Set(fs.readdirSync(IMAGES_DIR));

  for (let i = 0; i < affected.length; i++) {
    const page = affected[i];
    console.log(`\n[${i+1}/${affected.length}] Processing ${page.slug} (${page.emptyImages.length} empty images)`);

    // Fetch original page images
    const pageImages = fetchPageImages(page.originalUrl);
    console.log(`  Found ${pageImages.size} images on original page`);

    let content = fs.readFileSync(page.file, 'utf8');
    let modified = false;

    for (const emptyImg of page.emptyImages) {
      // Decode HTML entities in alt text for matching
      const altDecoded = emptyImg.alt
        .replace(/&#x26;/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'");

      // Try to find matching image by alt text
      let imgSrc = pageImages.get(emptyImg.alt) || pageImages.get(altDecoded);

      // Try partial matching if exact match fails
      if (!imgSrc && emptyImg.alt) {
        for (const [alt, src] of pageImages) {
          const altNorm = alt.toLowerCase().trim();
          const searchNorm = altDecoded.toLowerCase().trim();
          if (altNorm === searchNorm || altNorm.includes(searchNorm) || searchNorm.includes(altNorm)) {
            imgSrc = src;
            break;
          }
        }
      }

      if (!imgSrc) {
        totalFailed++;
        allFailed.push({ page: page.slug, alt: emptyImg.alt });
        continue;
      }

      // Make URL absolute
      if (imgSrc.startsWith('/')) {
        imgSrc = `https://www.abbvie.com${imgSrc}`;
      }

      // Generate local filename and download
      let localFilename = sanitizeFilename(urlToFilename(imgSrc));

      // Avoid collisions
      if (existingFiles.has(localFilename)) {
        // Check if it's the same image (same URL pattern)
        // If different, add suffix
        const ext = path.extname(localFilename);
        const base = path.basename(localFilename, ext);
        let counter = 2;
        while (existingFiles.has(`${base}-${counter}${ext}`)) counter++;
        // Only rename if we haven't already downloaded this exact URL
        // For now just reuse existing if filename matches
      }

      const destPath = path.join(IMAGES_DIR, localFilename);

      if (!fs.existsSync(destPath) || fs.statSync(destPath).size < 100) {
        try {
          await downloadFile(imgSrc, destPath);
          existingFiles.add(localFilename);
        } catch (e) {
          console.error(`  FAILED to download: ${localFilename} - ${e.message}`);
          totalFailed++;
          allFailed.push({ page: page.slug, alt: emptyImg.alt, url: imgSrc, error: e.message });
          continue;
        }
      }

      // Replace in content
      const oldTag = `<img src="" alt="${emptyImg.alt}"`;
      const newTag = `<img src="./images/${localFilename}" alt="${emptyImg.alt}"`;

      if (content.includes(oldTag)) {
        content = content.replace(oldTag, newTag);
        modified = true;
        totalFixed++;
      }
    }

    if (modified) {
      fs.writeFileSync(page.file, content, 'utf8');
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed: ${totalFixed}`);
  console.log(`Failed: ${totalFailed}`);

  if (allFailed.length > 0) {
    console.log(`\nFailed images:`);
    allFailed.forEach(f => console.log(`  ${f.page}: alt="${f.alt}" ${f.url || ''} ${f.error || '(no match found)'}`));
  }

  // Final count of remaining empty src
  let remaining = 0;
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.plain.html'));
  for (const file of files) {
    const c = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const m = c.match(/<img src="" /g);
    if (m) remaining += m.length;
  }
  console.log(`\nRemaining empty src: ${remaining}`);
}

main().catch(console.error);
