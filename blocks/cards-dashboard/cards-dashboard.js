import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  // Convert image links to img elements
  block.querySelectorAll('a[href]').forEach((link) => {
    const href = link.href || '';
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(href)
      || href.includes('scene7');
    if (isImage && !link.closest('picture')) {
      const parent = link.closest('p') || link.parentElement;
      const isSoleChild = parent && parent.children.length === 1
        && parent.textContent.trim() === link.textContent.trim();
      if (isSoleChild) {
        const img = document.createElement('img');
        img.src = href;
        img.alt = link.textContent.trim() || '';
        img.loading = 'lazy';
        const picture = document.createElement('picture');
        picture.appendChild(img);
        parent.replaceWith(picture);
      }
    }
  });

  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && (div.querySelector('picture') || div.querySelector('img'))) {
        div.className = 'cards-dashboard-card-image';
      } else {
        div.className = 'cards-dashboard-card-body';
      }
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const isExternal = img.src.startsWith('http') && !img.src.startsWith(window.location.origin);
    if (!isExternal) {
      const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
      moveInstrumentation(img, optimizedPic.querySelector('img'));
      img.closest('picture').replaceWith(optimizedPic);
    }
  });
  block.textContent = '';
  block.append(ul);
}
