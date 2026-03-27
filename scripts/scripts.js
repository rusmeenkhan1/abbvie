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
      || h1.closest('.hero-interior') || picture.closest('.hero-interior')) {
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
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

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
