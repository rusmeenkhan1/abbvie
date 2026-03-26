import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const pressReleases = [];
  const featured = [];

  [...block.children].forEach((row) => {
    const hasImage = row.querySelector('picture') || row.querySelector('img');
    if (hasImage) {
      featured.push(row);
    } else {
      pressReleases.push(row);
    }
  });

  block.textContent = '';

  // Press Releases column
  const pressCol = document.createElement('div');
  pressCol.className = 'cards-news-press';

  const pressHeading = document.createElement('h2');
  pressHeading.textContent = 'Press Releases';
  pressCol.append(pressHeading);

  const pressHr = document.createElement('hr');
  pressCol.append(pressHr);

  const pressList = document.createElement('ul');
  pressReleases.forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      div.className = 'cards-news-card-body';
    });
    pressList.append(li);
  });
  pressCol.append(pressList);

  // Featured column
  const featCol = document.createElement('div');
  featCol.className = 'cards-news-featured';

  const featHeading = document.createElement('h2');
  featHeading.textContent = 'Featured';
  featCol.append(featHeading);

  const featHr = document.createElement('hr');
  featCol.append(featHr);

  featured.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'cards-news-featured-card';
    moveInstrumentation(row, card);
    while (row.firstElementChild) card.append(row.firstElementChild);
    [...card.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'cards-news-card-image';
      } else {
        div.className = 'cards-news-card-body';
      }
    });
    card.querySelectorAll('picture > img').forEach((img) => {
      const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
      moveInstrumentation(img, optimizedPic.querySelector('img'));
      img.closest('picture').replaceWith(optimizedPic);
    });
    featCol.append(card);
  });

  block.append(pressCol);
  block.append(featCol);
}
