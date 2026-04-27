import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Our Leaders listing: entire card + photo should navigate to the leader profile
 * (same pattern as abbvie.com /who-we-are/our-leaders). Uses the profile URL from
 * the card body CTA, or an image-wrapped link if present.
 * @param {HTMLUListElement} ul
 */
function wireCardNavigation(ul) {
  if (!document.body.classList.contains('our-leaders')) return;

  ul.querySelectorAll(':scope > li').forEach((li) => {
    const imageCol = li.querySelector('.cards-leaders-card-image');
    const bodyCol = li.querySelector('.cards-leaders-card-body');
    const imageLink = imageCol?.querySelector('a[href]');
    const bodyLink = bodyCol?.querySelector('a[href]');
    const href = (imageLink || bodyLink)?.getAttribute('href');
    if (!href || href === '#') return;

    if (imageLink && imageCol?.contains(imageLink)) {
      return;
    }

    const heading = bodyCol?.querySelector('h4, h3');
    const label = heading?.textContent?.trim() || bodyLink?.textContent?.trim() || 'View leader profile';

    const cover = document.createElement('a');
    cover.className = 'cards-leaders-card-cover-link';
    cover.href = href;
    cover.setAttribute('aria-label', label);
    li.prepend(cover);

    if (bodyLink) {
      bodyLink.setAttribute('tabindex', '-1');
      bodyLink.setAttribute('aria-hidden', 'true');
    }
  });
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-leaders-card-image';
      else div.className = 'cards-leaders-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const isExternal = img.src.startsWith('http') && !img.src.startsWith(window.location.origin);
    if (!isExternal) {
      img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
    }
  });
  block.replaceChildren(ul);
  wireCardNavigation(ul);
}
