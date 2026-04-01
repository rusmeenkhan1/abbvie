import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    // Check if h1 or picture is already inside a hero or hero-interior block
    if (h1.closest('.hero') || picture.closest('.hero')
      || h1.closest('.hero-interior') || picture.closest('.hero-interior')
      || h1.closest('.hero-article') || picture.closest('.hero-article')) {
      return; // Don't create a duplicate hero block
    }
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }

    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates article body content after hero-article sections.
 * Converts consecutive image paragraphs into a carousel and
 * video thumbnail patterns into a video embed overlay.
 * Runs after section/block decoration to avoid block loading conflicts.
 * @param {Element} main The main element
 */
function decorateArticleBody(main) {
  const heroSection = main.querySelector('.section.hero-article-container');
  if (!heroSection) return;

  // Find the body section (next sibling of hero section)
  const bodySection = heroSection.nextElementSibling;
  if (!bodySection || !bodySection.classList.contains('section')) return;

  const dcw = bodySection.querySelector('.default-content-wrapper');
  if (!dcw) return;

  // Build carousel from consecutive image-only paragraphs
  const children = [...dcw.children];
  const imgParagraphs = [];

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    const isImgP = child.tagName === 'P'
      && child.querySelector('img')
      && child.textContent.trim() === '';

    if (isImgP) {
      imgParagraphs.push(child);
    } else {
      if (imgParagraphs.length >= 2) {
        const carousel = document.createElement('div');
        carousel.className = 'article-carousel';

        const slides = document.createElement('div');
        slides.className = 'carousel-slides';

        imgParagraphs.forEach((p) => {
          const slide = document.createElement('div');
          slide.className = 'carousel-slide';
          const pic = p.querySelector('picture') || p.querySelector('img');
          slide.append(pic);
          slides.append(slide);
          p.remove();
        });

        carousel.append(slides);

        const nav = document.createElement('div');
        nav.className = 'carousel-nav';
        const prevBtn = document.createElement('button');
        prevBtn.setAttribute('aria-label', 'Previous slide');
        prevBtn.innerHTML = '&#8249;';
        const nextBtn = document.createElement('button');
        nextBtn.setAttribute('aria-label', 'Next slide');
        nextBtn.innerHTML = '&#8250;';
        nav.append(prevBtn, nextBtn);
        carousel.append(nav);

        child.before(carousel);

        let current = 0;
        const total = slides.children.length;
        const updateSlide = () => {
          slides.style.transform = `translateX(-${current * 100}%)`;
        };
        prevBtn.addEventListener('click', () => {
          current = (current - 1 + total) % total;
          updateSlide();
        });
        nextBtn.addEventListener('click', () => {
          current = (current + 1) % total;
          updateSlide();
        });
      }
      imgParagraphs.length = 0;
    }
  }

  // Build video embed from thumbnail + title + watch pattern
  const updatedChildren = [...dcw.children];
  for (let i = 0; i < updatedChildren.length - 2; i += 1) {
    const el1 = updatedChildren[i];
    const el2 = updatedChildren[i + 1];
    const el3 = updatedChildren[i + 2];

    const isVideoImg = el1.tagName === 'P'
      && el1.querySelector('img')
      && el1.textContent.trim() === '';
    const isTitleP = el2.tagName === 'P'
      && !el2.querySelector('img')
      && el2.textContent.trim().length > 5
      && el2.textContent.trim().length < 100;
    const isWatchP = el3.tagName === 'P'
      && el3.textContent.trim().toLowerCase().startsWith('watch');

    if (isVideoImg && isTitleP && isWatchP) {
      const embed = document.createElement('div');
      embed.className = 'article-video-embed';

      const pic = el1.querySelector('picture') || el1.querySelector('img');
      embed.append(pic);

      const overlay = document.createElement('div');
      overlay.className = 'video-overlay';

      const heading = document.createElement('h2');
      heading.textContent = el2.textContent.trim();

      const btn = document.createElement('button');
      btn.className = 'video-play-btn';
      btn.textContent = el3.textContent.trim();

      overlay.append(heading, btn);
      embed.append(overlay);

      el1.replaceWith(embed);
      el2.remove();
      el3.remove();
      break;
    }
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Moves instrumentation attributes from source to target element.
 * @param {Element} source The source element
 * @param {Element} target The target element
 */
export function moveInstrumentation(source, target) {
  if (!source || !target) return;
  [...source.attributes].forEach((attr) => {
    if (attr.name.startsWith('data-aue-') || attr.name.startsWith('data-richtext-')) {
      target.setAttribute(attr.name, attr.value);
      source.removeAttribute(attr.name);
    }
  });
}

/**
 * Fixes images that fail to load through the media pipeline (local dev only).
 * The AEM CLI cannot proxy Scene7 images; this provides CDN fallbacks.
 * @param {Element} main The main container element
 */
function fixBrokenImages(main) {
  const imageMap = {
    'wp card story image': 'https://abbvie.scene7.com/is/image/abbviecorp/wp-card-story-image',
    'Portrait of two women: one a Parkinson\u2019s patient and the other an AbbVie scientist': 'https://abbvie.scene7.com/is/image/abbviecorp/wp-sponsorship-hero',
    'ambily card image': 'https://abbvie.scene7.com/is/image/abbviecorp/ambily-card-image',
    'kids playing soccer on grass': 'https://abbvie.scene7.com/is/image/abbviecorp/kids-playing-soccer-grass',
    'sitting in hammock by lake': 'https://abbvie.scene7.com/is/image/abbviecorp/sitting-in-hammock-by-lake-hero',
  };

  /**
   * Replace an img (and its picture wrapper) with a fresh img element
   * pointing to the CDN fallback URL.
   */
  function replaceWithFallback(img, fallbackUrl) {
    const newImg = document.createElement('img');
    newImg.src = fallbackUrl;
    newImg.alt = img.alt;
    newImg.loading = img.loading || 'lazy';
    const picture = img.closest('picture');
    if (picture) {
      picture.replaceWith(newImg);
    } else {
      img.replaceWith(newImg);
    }
  }

  // Replace broken images immediately where detectable
  main.querySelectorAll('img').forEach((img) => {
    const fallback = imageMap[img.alt];
    if (!fallback) return;
    if (img.src.includes('about:error')) {
      replaceWithFallback(img, fallback);
    }
  });

  // For images still loading, attach error handlers to swap on failure
  main.querySelectorAll('img').forEach((img) => {
    const fallback = imageMap[img.alt];
    if (!fallback) return;
    img.addEventListener('error', () => replaceWithFallback(img, fallback), { once: true });
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  fixBrokenImages(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
  decorateArticleBody(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Fetches the query index and injects the published date into hero-article blocks.
 * Matches the current page path against the index to find the corresponding date.
 * @param {Element} main The main element
 */
async function addArticleDate(main) {
  const meta = main.querySelector('.hero-article .hero-article-meta');
  if (!meta) return;

  // Skip if a date span already exists with content
  const existingDate = meta.querySelector('.hero-article-date');
  if (existingDate?.textContent.trim()) return;

  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) return;
    const { data } = await resp.json();
    if (!data) return;

    let { pathname } = window.location;
    if (pathname.endsWith('.html')) pathname = pathname.slice(0, -5);
    if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);

    const entry = data.find((e) => e.path === pathname);
    if (!entry?.lastModified) return;

    const date = new Date(entry.lastModified * 1000);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const dateSpan = document.createElement('span');
    dateSpan.className = 'hero-article-date';
    dateSpan.textContent = formatted;
    meta.prepend(dateSpan);
  } catch {
    // silently fail — date is non-critical
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  addArticleDate(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
