import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Build the carousel navigation (prev/next arrows + dot indicators).
 * @param {number} count – total number of slides
 * @param {Function} goTo – callback that receives the target index
 * @returns {HTMLElement} the nav container
 */
function buildCarouselNav(count, goTo) {
  const nav = document.createElement('div');
  nav.className = 'cards-news-carousel-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Press release navigation');

  const prev = document.createElement('button');
  prev.className = 'cards-news-carousel-prev';
  prev.setAttribute('aria-label', 'Previous press release');
  prev.type = 'button';
  prev.innerHTML = '<svg width="10" height="16" viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 1L1.5 8L8.5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const next = document.createElement('button');
  next.className = 'cards-news-carousel-next';
  next.setAttribute('aria-label', 'Next press release');
  next.type = 'button';
  next.innerHTML = '<svg width="10" height="16" viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1L8.5 8L1.5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const dots = document.createElement('div');
  dots.className = 'cards-news-carousel-dots';
  dots.setAttribute('role', 'tablist');
  dots.setAttribute('aria-label', 'Press release slides');

  for (let i = 0; i < count; i += 1) {
    const dot = document.createElement('button');
    dot.className = 'cards-news-carousel-dot';
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to press release ${i + 1}`);
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goTo(i));
    dots.append(dot);
  }

  prev.addEventListener('click', () => goTo('prev'));
  next.addEventListener('click', () => goTo('next'));

  nav.append(prev, dots, next);
  return nav;
}

export default function decorate(block) {
  // Convert image links to img elements before classification
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
        parent.replaceWith(img);
      }
    }
  });

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

  // Carousel viewport – contains all slides, only one visible at a time
  const viewport = document.createElement('div');
  viewport.className = 'cards-news-carousel-viewport';

  pressReleases.forEach((row, idx) => {
    const slide = document.createElement('div');
    slide.className = 'cards-news-carousel-slide';
    if (idx === 0) slide.classList.add('active');
    slide.setAttribute('role', 'tabpanel');
    slide.setAttribute('aria-label', `Press release ${idx + 1} of ${pressReleases.length}`);
    moveInstrumentation(row, slide);

    while (row.firstElementChild) {
      const div = row.firstElementChild;
      div.className = 'cards-news-card-body';
      slide.append(div);
    }
    viewport.append(slide);
  });

  pressCol.append(viewport);

  // Carousel state & logic
  let current = 0;
  const total = pressReleases.length;

  function goTo(target) {
    let next;
    if (target === 'prev') {
      next = (current - 1 + total) % total;
    } else if (target === 'next') {
      next = (current + 1) % total;
    } else {
      next = target;
    }
    if (next === current) return;

    const slides = viewport.querySelectorAll('.cards-news-carousel-slide');
    slides[current].classList.remove('active');
    slides[next].classList.add('active');

    const dots = pressCol.querySelectorAll('.cards-news-carousel-dot');
    dots[current].classList.remove('active');
    dots[current].setAttribute('aria-selected', 'false');
    dots[next].classList.add('active');
    dots[next].setAttribute('aria-selected', 'true');

    current = next;
  }

  // Only add nav if there are multiple slides
  if (total > 1) {
    const nav = buildCarouselNav(total, goTo);
    pressCol.append(nav);
  }

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
      const hasPic = div.querySelector('picture') || div.querySelector('img');
      if (div.children.length === 1 && hasPic) {
        div.className = 'cards-news-card-image';
      } else {
        div.className = 'cards-news-card-body';
      }
    });
    card.querySelectorAll('picture > img').forEach((img) => {
      const isExternal = img.src.startsWith('http') && !img.src.startsWith(window.location.origin);
      if (!isExternal) {
        const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
        moveInstrumentation(img, optimizedPic.querySelector('img'));
        img.closest('picture').replaceWith(optimizedPic);
      }
    });
    featCol.append(card);
  });

  block.append(pressCol);
  block.append(featCol);
}
