#!/usr/bin/env node
/**
 * Fix missing metadata by extracting from original AbbVie pages.
 * Adds: Description, og:title where missing.
 * Uses static HTML meta tags (not JS-rendered).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.resolve(__dirname, '../../content/who-we-are/our-stories');

// All 99 pages
const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.plain.html'));

function fetchMeta(slug) {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  try {
    const html = execSync(
      `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 "${url}"`,
      { maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' },
    );

    const meta = {};

    // Title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) meta.title = titleMatch[1].trim();

    // og:title
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
    if (ogTitleMatch) meta.ogTitle = ogTitleMatch[1].trim();

    // Description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    if (descMatch) meta.description = descMatch[1].trim();

    // og:description
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);
    if (ogDescMatch) meta.ogDescription = ogDescMatch[1].trim();

    // itemprop name (AbbVie has this)
    const itemNameMatch = html.match(/<meta\s+itemprop=["']name["']\s+content=["']([^"']+)["']/i);
    if (itemNameMatch) meta.itemName = itemNameMatch[1].trim();

    return meta;
  } catch (e) {
    return null;
  }
}

function escapeHtml(text) {
  return text.replace(/&(?!#x26;|amp;|lt;|gt;|quot;)/g, '&#x26;');
}

function main() {
  let descAdded = 0;
  let descSkipped = 0;
  const ogTitleFixed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const slug = file.replace('.plain.html', '');
    const filePath = path.join(CONTENT_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');

    const needsDesc = !content.includes('<div>Description</div>');
    // Don't check og:title - our extraction earlier showed all pages already have it

    if (!needsDesc) continue;

    process.stdout.write(`[${i + 1}/${files.length}] ${slug} ... `);

    const meta = fetchMeta(slug);
    if (!meta) {
      console.log('FETCH FAILED');
      continue;
    }

    let modified = false;

    // Add Description
    if (needsDesc) {
      // Use description, og:description, or subtitle from hero as fallback
      const desc = meta.description || meta.ogDescription;

      if (desc) {
        const escaped = escapeHtml(desc);
        // Insert after Title row in metadata
        const titleRowEnd = content.indexOf('</div></div><div><div>og:title');
        if (titleRowEnd > -1) {
          const insertPoint = titleRowEnd + '</div></div>'.length;
          const descRow = `<div><div>Description</div><div>${escaped}</div></div>`;
          content = content.substring(0, insertPoint) + descRow + content.substring(insertPoint);
          modified = true;
          descAdded++;
          console.log(`DESC added: "${desc.substring(0, 60)}..."`);
        } else {
          // Try inserting after Title row
          const titlePattern = '<div><div>Title</div><div>';
          const titleIdx = content.indexOf(titlePattern);
          if (titleIdx > -1) {
            const afterTitle = content.indexOf('</div></div>', titleIdx + titlePattern.length);
            if (afterTitle > -1) {
              const insertPoint = afterTitle + '</div></div>'.length;
              const descRow = `<div><div>Description</div><div>${escaped}</div></div>`;
              content = content.substring(0, insertPoint) + descRow + content.substring(insertPoint);
              modified = true;
              descAdded++;
              console.log(`DESC added (after Title): "${desc.substring(0, 60)}..."`);
            }
          }
        }
      } else {
        // Fall back to hero subtitle
        const heroMatch = content.match(/<div class="hero-article">[\s\S]*?<\/div><\/div><\/div><\/div><div><div>([^<]+)<\/div><\/div><\/div>/);
        if (heroMatch && heroMatch[1].length > 20) {
          const subtitle = heroMatch[1].trim();
          const escaped = escapeHtml(subtitle);
          const titlePattern = '<div><div>Title</div><div>';
          const titleIdx = content.indexOf(titlePattern);
          if (titleIdx > -1) {
            const afterTitle = content.indexOf('</div></div>', titleIdx + titlePattern.length);
            if (afterTitle > -1) {
              const insertPoint = afterTitle + '</div></div>'.length;
              const descRow = `<div><div>Description</div><div>${escaped}</div></div>`;
              content = content.substring(0, insertPoint) + descRow + content.substring(insertPoint);
              modified = true;
              descAdded++;
              console.log(`DESC added (from subtitle): "${subtitle.substring(0, 60)}..."`);
            }
          }
        } else {
          descSkipped++;
          console.log('NO DESC FOUND');
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Descriptions added: ${descAdded}`);
  console.log(`Descriptions skipped: ${descSkipped}`);

  // Verify
  let remaining = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    if (content.includes('class="metadata"') && !content.includes('<div>Description</div>')) {
      remaining++;
      console.log(`  Still missing: ${file.replace('.plain.html', '')}`);
    }
  }
  console.log(`Remaining without Description: ${remaining}`);
}

main();
