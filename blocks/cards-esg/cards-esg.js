import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  const rows = [...block.children];

  // First row is the background image
  const bgRow = rows.shift();
  if (bgRow) {
    const bgImg = bgRow.querySelector('img');
    if (bgImg) {
      const optimizedPic = createOptimizedPicture(bgImg.src, bgImg.alt, false, [{ width: '1200' }]);
      const bgContainer = document.createElement('div');
      bgContainer.className = 'cards-esg-bg';
      bgContainer.append(optimizedPic);
      block.textContent = '';
      block.append(bgContainer);
    }
  }

  // Remaining rows are the card overlays
  rows.forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-esg-card-image';
      else div.className = 'cards-esg-card-body';
    });
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });

  block.append(ul);
}
