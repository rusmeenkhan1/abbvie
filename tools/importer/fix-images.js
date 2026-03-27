#!/usr/bin/env node
/**
 * Downloads all external images from imported content files
 * and replaces URLs with local ./images/ references.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Collect all .plain.html files
const htmlFiles = fs.readdirSync(CONTENT_DIR)
  .filter(f => f.endsWith('.plain.html'))
  .map(f => path.join(CONTENT_DIR, f));

console.log(`Found ${htmlFiles.length} HTML files to process`);

// Extract all unique external image URLs across all files
const urlToFiles = new Map(); // url -> Set of file paths that use it
const allExternalUrls = new Set();

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Match src="https://..." attributes
  const srcMatches = content.matchAll(/src="(https:\/\/[^"]+)"/g);
  for (const match of srcMatches) {
    const url = match[1];
    allExternalUrls.add(url);
    if (!urlToFiles.has(url)) urlToFiles.set(url, new Set());
    urlToFiles.get(url).add(file);
  }
}

console.log(`Found ${allExternalUrls.size} unique external image URLs`);

// Generate a clean filename from a Scene7 or external URL
function urlToFilename(url) {
  try {
    const u = new URL(url.replace(/&#x26;/g, '&'));
    let pathname = u.pathname;

    // For scene7 URLs like /is/image/abbviecorp/NAME or /is/content/abbviecorp/NAME
    const scene7Match = pathname.match(/\/is\/(?:image|content)\/abbviecorp\/(.+)/);
    if (scene7Match) {
      let name = scene7Match[1];
      // Remove any path segments
      name = name.replace(/\//g, '-');

      // Determine extension from fmt param or default
      const fmt = u.searchParams.get('fmt');
      if (fmt) {
        return `${name}.${fmt}`;
      }
      // Check if URL path ends with extension
      const extMatch = name.match(/\.(jpg|jpeg|png|gif|svg|webp|avif)$/i);
      if (extMatch) {
        return name;
      }
      // /is/content/ often serves SVG/animated content
      if (pathname.includes('/is/content/')) {
        return `${name}.svg`;
      }
      // Default to webp for /is/image/
      return `${name}.webp`;
    }

    // Generic URL - use last path segment
    let name = pathname.split('/').pop() || 'image';
    // Ensure it has an extension
    if (!name.match(/\.(jpg|jpeg|png|gif|svg|webp|avif)$/i)) {
      name += '.webp';
    }
    return name;
  } catch (e) {
    return `image-${Date.now()}.webp`;
  }
}

// Sanitize filename
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Download a URL to a local file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    // Decode HTML entities in URL
    const cleanUrl = url.replace(/&#x26;/g, '&').replace(/&amp;/g, '&');

    const protocol = cleanUrl.startsWith('https') ? https : http;
    const request = protocol.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      timeout: 30000,
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${cleanUrl}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destPath);
      });
      fileStream.on('error', reject);
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${cleanUrl}`));
    });
  });
}

// Main execution
async function main() {
  const urlToLocal = new Map(); // external URL -> local filename

  // Build URL to filename mapping
  const filenameCount = new Map(); // track duplicates
  for (const url of allExternalUrls) {
    let filename = sanitizeFilename(urlToFilename(url));

    // Handle duplicate filenames
    if (filenameCount.has(filename)) {
      const count = filenameCount.get(filename) + 1;
      filenameCount.set(filename, count);
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      filename = `${base}-${count}${ext}`;
    } else {
      filenameCount.set(filename, 1);
    }

    urlToLocal.set(url, filename);
  }

  // Download images in batches
  const urls = [...allExternalUrls];
  const BATCH_SIZE = 10;
  let downloaded = 0;
  let failed = 0;
  const failedUrls = [];

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (url) => {
      const filename = urlToLocal.get(url);
      const destPath = path.join(IMAGES_DIR, filename);

      // Skip if already downloaded
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        downloaded++;
        return;
      }

      try {
        await downloadFile(url, destPath);
        downloaded++;
        if (downloaded % 20 === 0) {
          console.log(`  Downloaded ${downloaded}/${urls.length}...`);
        }
      } catch (e) {
        failed++;
        failedUrls.push({ url, error: e.message });
        console.error(`  FAILED: ${filename} - ${e.message}`);
      }
    });

    await Promise.all(promises);
  }

  console.log(`\nDownload complete: ${downloaded} succeeded, ${failed} failed out of ${urls.length}`);

  if (failedUrls.length > 0) {
    console.log('\nFailed URLs:');
    failedUrls.forEach(f => console.log(`  ${f.url} -> ${f.error}`));
  }

  // Now replace URLs in all HTML files
  console.log('\nUpdating HTML files...');
  let filesUpdated = 0;
  let refsReplaced = 0;

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    for (const [extUrl, localFilename] of urlToLocal) {
      const localRef = `./images/${localFilename}`;
      // Replace src="EXTERNAL_URL" with src="./images/filename"
      const escaped = extUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`src="${escaped}"`, 'g');
      const before = content;
      content = content.replace(regex, `src="${localRef}"`);
      if (content !== before) {
        modified = true;
        refsReplaced++;
      }
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      filesUpdated++;
    }
  }

  console.log(`Updated ${filesUpdated} files, replaced ${refsReplaced} image references`);

  // Final verification
  let remainingExternal = 0;
  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.matchAll(/src="(https:\/\/[^"]+)"/g);
    for (const m of matches) {
      remainingExternal++;
    }
  }
  console.log(`\nRemaining external image references: ${remainingExternal}`);
}

main().catch(console.error);
