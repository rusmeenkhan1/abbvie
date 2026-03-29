#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('child_process');

const slugs = ['change-from-within', 'day-in-the-life-creating-impact-with-nonprofit-partners'];

slugs.forEach((slug) => {
  const url = `https://www.abbvie.com/who-we-are/our-stories/${slug}.html`;
  const html = execSync(
    `curl -sL -H "User-Agent: Mozilla/5.0" --max-time 30 "${url}"`,
    { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' },
  );

  const hasCards = html.includes('card-title') || html.includes('card-container');
  console.log(`${slug}: has card titles: ${hasCards}`);

  if (hasCards) {
    const titles = [];
    const titleRe = /class="card-title"[^>]*>([\s\S]*?)<\//gi;
    let m = titleRe.exec(html);
    while (m !== null) {
      titles.push(m[1].replace(/<[^>]+>/g, '').trim());
      m = titleRe.exec(html);
    }
    console.log('  Card titles:', titles);

    const dates = [];
    const dateRe = /class="card-metadata-date"[^>]*>\s*([\s\S]*?)\s*<\/span>/gi;
    m = dateRe.exec(html);
    while (m !== null) {
      dates.push(m[1].replace(/\s+/g, ' ').trim());
      m = dateRe.exec(html);
    }
    console.log('  Card dates:', dates);

    const descs = [];
    const descRe = /class="card-description"[^>]*>([\s\S]*?)<\/p>/gi;
    m = descRe.exec(html);
    while (m !== null) {
      descs.push(m[1].replace(/<[^>]+>/g, '').trim().substring(0, 80));
      m = descRe.exec(html);
    }
    console.log('  Card descriptions:', descs);
  }
  console.log();
});
