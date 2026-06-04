#!/usr/bin/env node
/**
 * Stamp relative JS/CSS imports with a fresh cache-bust query after tool changes.
 * Run before commit/push: npm run stamp:bulk-tool
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolRoot = dirname(fileURLToPath(import.meta.url));
const stamp = `?t=${Date.now().toString(36)}`;

const importRe = /from\s+(['"])(\.[^'"]+\.js)(\?[bt]=[^'"]*)?\1/g;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      return;
    }
    if (!entry.name.endsWith('.js')) return;
    const source = await readFile(path, 'utf8');
    const next = source.replace(importRe, (_, quote, pathPart) => (
      `from ${quote}${pathPart}${stamp}${quote}`
    ));
    if (next !== source) await writeFile(path, next);
  }));
}

async function stampHtml() {
  const htmlPath = join(toolRoot, '../bulk-preview-publish.html');
  const source = await readFile(htmlPath, 'utf8');
  const cssRe = /(\.\/bulk-preview-publish\/bulk-preview-publish\.css)(\?[bt]=[^"']*)?/;
  const jsRe = /(\.\/bulk-preview-publish\/bulk-preview-publish\.js)(\?[bt]=[^"']*)?/;
  const next = source
    .replace(cssRe, `$1${stamp}`)
    .replace(jsRe, `$1${stamp}`);
  if (next !== source) await writeFile(htmlPath, next);
}

await walk(toolRoot);
await stampHtml();
console.log(`[bulk-preview-publish] stamped assets with ${stamp}`);
