#!/usr/bin/env node
const { execSync } = require('child_process');

const slugs = ['change-from-within', 'day-in-the-life-creating-impact-with-nonprofit-partners'];

for (const slug of slugs) {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  const html = execSync(
    `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 "${url}"`,
    { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
  );

  const hasCards = html.includes('card-title') || html.includes('card-container');
  console.log(`${slug}: has card titles: ${hasCards}`);

  if (hasCards) {
    const titles = [];
    const titleRe = /class="card-title"[^>]*>([\s\S]*?)<\//gi;
    let m;
    while ((m = titleRe.exec(html)) !== null) {
      titles.push(m[1].replace(/<[^>]+>/g, '').trim());
    }
    console.log('  Card titles:', titles);

    const dates = [];
    const dateRe = /class="card-metadata-date"[^>]*>\s*([\s\S]*?)\s*<\/span>/gi;
    while ((m = dateRe.exec(html)) !== null) {
      dates.push(m[1].replace(/\s+/g, ' ').trim());
    }
    console.log('  Card dates:', dates);

    const descs = [];
    const descRe = /class="card-description"[^>]*>([\s\S]*?)<\/p>/gi;
    while ((m = descRe.exec(html)) !== null) {
      descs.push(m[1].replace(/<[^>]+>/g, '').trim().substring(0, 80));
    }
    console.log('  Card descriptions:', descs);
  }
  console.log();
}
