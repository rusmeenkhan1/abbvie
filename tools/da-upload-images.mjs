#!/usr/bin/env node
/**
 * Upload images to DA (Document Authoring) for AEM Edge Delivery Services.
 *
 * Usage:
 *   1. Sign in to https://da.live
 *   2. Open browser DevTools → Application → Local Storage → https://da.live
 *   3. Copy the value of the "da_token" key
 *   4. Run: node tools/da-upload-images.mjs <token>
 *
 * This script uploads all images from /workspace/images/ to DA
 * and outputs the media paths to use in content.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const DA_ORG = 'rusmeenkhan1';
const DA_SITE = 'abbvie';
const IMAGES_DIR = join(import.meta.dirname, '..', 'images');

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

async function uploadImage(filePath, fileName, token) {
  const ext = extname(fileName).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const fileData = readFileSync(filePath);

  const formData = new FormData();
  formData.append('data', new Blob([fileData], { type: mimeType }), fileName);

  const url = `https://admin.da.live/source/${DA_ORG}/${DA_SITE}/${fileName}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upload failed for ${fileName}: ${resp.status} ${text}`);
  }

  const result = await resp.json();
  return result;
}

async function previewResource(path) {
  const url = `https://admin.hlx.page/preview/${DA_ORG}/${DA_SITE}/main/${path}`;
  const resp = await fetch(url, { method: 'POST' });
  if (resp.ok) {
    const result = await resp.json();
    return result.preview?.url;
  }
  return null;
}

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error('Usage: node tools/da-upload-images.mjs <da_token>');
    console.error('');
    console.error('To get your DA token:');
    console.error('  1. Sign in to https://da.live');
    console.error('  2. Open browser DevTools → Application → Local Storage → https://da.live');
    console.error('  3. Copy the value of the "da_token" key');
    process.exit(1);
  }

  const files = readdirSync(IMAGES_DIR).filter((f) => Object.keys(MIME_TYPES).includes(extname(f).toLowerCase()));

  console.log(`Found ${files.length} images to upload to DA (${DA_ORG}/${DA_SITE}):\n`);

  const results = [];
  for (const file of files) {
    const filePath = join(IMAGES_DIR, file);
    try {
      console.log(`  Uploading ${file}...`);
      const result = await uploadImage(filePath, file, token);
      console.log(`  ✓ ${file} → ${JSON.stringify(result)}`);
      results.push({ file, result });
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  console.log('\nPreviewing index page...');
  const previewUrl = await previewResource('');
  if (previewUrl) {
    console.log(`  Preview: ${previewUrl}`);
  }

  console.log('\nDone! Open the page in the DA editor to verify images are visible.');
  console.log(`  DA editor: https://da.live/#/${DA_ORG}/${DA_SITE}`);
}

main();
