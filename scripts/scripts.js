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

  // Build carousel from consecutive image paragraphs (with or without captions)
  const children = [...dcw.children];
  const imgParagraphs = [];

  // An image paragraph is a <p> with an <img> where the text is either empty or a short caption
  function isCarouselCandidate(el) {
    if (el.tagName !== 'P' || !el.querySelector('img')) return false;
    const text = el.textContent.trim();
    // Pure image paragraph (no text) or image with caption (< 300 chars)
    return text === '' || text.length < 300;
  }

  function buildCarousel(paragraphs, insertBeforeEl) {
    const carousel = document.createElement('div');
    carousel.className = 'article-carousel';

    const slides = document.createElement('div');
    slides.className = 'carousel-slides';

    paragraphs.forEach((p) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      const pic = p.querySelector('picture') || p.querySelector('img');
      slide.append(pic);
      const caption = p.textContent.trim();
      if (caption) {
        const captionEl = document.createElement('p');
        captionEl.className = 'carousel-caption';
        captionEl.textContent = caption;
        slide.append(captionEl);
      }
      slides.append(slide);
      p.remove();
    });

    carousel.append(slides);

    const nav = document.createElement('div');
    nav.className = 'carousel-nav';
    const prevBtn = document.createElement('button');
    prevBtn.setAttribute('aria-label', 'Previous slide');
    prevBtn.innerHTML = '&#8592;';
    const nextBtn = document.createElement('button');
    nextBtn.setAttribute('aria-label', 'Next slide');
    nextBtn.innerHTML = '&#8594;';
    nav.append(prevBtn, nextBtn);
    carousel.append(nav);

    insertBeforeEl.before(carousel);

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

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];

    if (isCarouselCandidate(child)) {
      imgParagraphs.push(child);
    } else {
      if (imgParagraphs.length >= 2) {
        buildCarousel(imgParagraphs, child);
      }
      imgParagraphs.length = 0;
    }
  }
  // Handle trailing image paragraphs
  if (imgParagraphs.length >= 2) {
    const lastImg = imgParagraphs[imgParagraphs.length - 1];
    const afterEl = lastImg.nextElementSibling;
    if (afterEl) {
      buildCarousel(imgParagraphs, afterEl);
    }
  }

  // Add separators before h2 elements (except the very first heading)
  const h2s = [...dcw.querySelectorAll('h2')];
  h2s.forEach((h2, idx) => {
    if (idx > 0 && !h2.previousElementSibling?.matches('hr')) {
      const hr = document.createElement('hr');
      h2.before(hr);
    }
  });

  // Detect and style media inquiries section (run early so other detectors can check for it)
  dcw.querySelectorAll('p').forEach((p) => {
    const strong = p.querySelector('strong');
    if (strong && strong.textContent.trim().toLowerCase().includes('media inquiries')) {
      if (!p.previousElementSibling?.matches('hr')) {
        const hr = document.createElement('hr');
        p.before(hr);
      }
      p.classList.add('article-media-inquiries');
    }
  });

  // Alternate pattern: <h3>Media inquiries:</h3><p>Email:...</p>
  dcw.querySelectorAll('h3').forEach((h3) => {
    if (h3.textContent.trim().toLowerCase().includes('media inquiries')) {
      const nextP = h3.nextElementSibling;
      if (nextP?.tagName === 'P' && nextP.querySelector('a[href^="mailto:"]')) {
        const merged = document.createElement('p');
        merged.className = 'article-media-inquiries';
        merged.innerHTML = `<strong>${h3.textContent.trim()}</strong> ${nextP.innerHTML}`;
        if (!h3.previousElementSibling?.matches('hr')) {
          h3.before(document.createElement('hr'));
        }
        h3.replaceWith(merged);
        nextP.remove();
      }
    }
  });

  // Detect and convert references to collapsible accordion (run BEFORE pullquote detection)
  [...dcw.querySelectorAll('p')].forEach((p) => {
    if (p.textContent.trim() !== 'References') return;

    const details = document.createElement('details');
    details.className = 'article-references';
    const summary = document.createElement('summary');
    summary.innerHTML = 'References <span class="article-references-icon"></span>';
    details.append(summary);
    const content = document.createElement('div');
    content.className = 'article-references-content';

    // Collect all following siblings that are part of the references
    const toRemove = [];
    let next = p.nextElementSibling;
    while (next) {
      if (next.classList.contains('article-media-inquiries')
        || next.classList.contains('article-pullquote')
        || next.tagName === 'HR'
        || next.tagName === 'H2') break;
      // Skip "Expand All / Collapse All" filler paragraphs
      const txt = next.textContent.trim();
      if (txt === 'Expand All  Collapse All' || txt === 'Expand All Collapse All') {
        toRemove.push(next);
        next = next.nextElementSibling;
      } else {
        content.append(next.cloneNode(true));
        toRemove.push(next);
        next = next.nextElementSibling;
      }
    }

    if (content.children.length > 0) {
      details.append(content);
      p.replaceWith(details);
      toRemove.forEach((el) => el.remove());
      // Remove stray <hr> immediately after the references accordion
      if (details.nextElementSibling?.tagName === 'HR') {
        details.nextElementSibling.remove();
      }
    }
  });

  // Detect and decorate pullquotes
  // Pattern: quote paragraph + optional headshot image + author paragraph (Name<br>Title)
  function isAuthorAttribution(el) {
    if (el.tagName !== 'P' || el.classList.contains('article-media-inquiries')) return false;
    if (!el.querySelector('br') || el.querySelector('strong') || el.querySelector('img')) return false;
    const textLen = el.textContent.trim().length;
    if (textLen > 120 || textLen < 10) return false;
    const parts = el.innerHTML.split(/<br\s*\/?>/i).map((p) => p.replace(/<[^>]+>/g, '').trim());
    if (parts.length < 2 || parts[0].length > 50 || parts[0].length < 3) return false;
    return /^[A-Z]/.test(parts[0]);
  }

  const pqElements = [...dcw.children];
  pqElements.forEach((el, i) => {
    if (i === 0 || !isAuthorAttribution(el)) return;

    const parts = el.innerHTML.split(/<br\s*\/?>/i).map((p) => p.replace(/<[^>]+>/g, '').trim());
    let quoteP = null;
    let headshotP = null;
    const prev = pqElements[i - 1];
    const prevPrev = i >= 2 ? pqElements[i - 2] : null;

    if (prev?.tagName === 'P' && prev.querySelector('img') && prev.textContent.trim() === '') {
      headshotP = prev;
      if (prevPrev?.tagName === 'P' && !prevPrev.querySelector('img') && !prevPrev.querySelector('strong')) {
        quoteP = prevPrev;
      }
    } else if (prev?.tagName === 'P' && !prev.querySelector('img') && !prev.querySelector('strong')) {
      quoteP = prev;
    }

    if (!quoteP) return;
    if (quoteP.textContent.includes('Media inquiries') || quoteP.textContent === 'References') return;

    const pullquote = document.createElement('div');
    pullquote.className = 'article-pullquote';

    const icon = document.createElement('div');
    icon.className = 'article-pullquote-icon';
    icon.setAttribute('aria-hidden', 'true');

    const textDiv = document.createElement('div');
    textDiv.className = 'article-pullquote-text';
    textDiv.innerHTML = quoteP.innerHTML;

    const authorDiv = document.createElement('div');
    authorDiv.className = 'article-pullquote-author';
    if (headshotP) {
      const img = headshotP.querySelector('img');
      if (img) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'article-pullquote-headshot';
        imgWrap.append(img);
        authorDiv.append(imgWrap);
      }
    }
    const [firstName, ...restParts] = parts;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'article-pullquote-name';
    nameSpan.textContent = firstName;
    const titleSpan = document.createElement('span');
    titleSpan.className = 'article-pullquote-title';
    titleSpan.textContent = restParts.join(', ');
    authorDiv.append(nameSpan, titleSpan);

    pullquote.append(icon, textDiv, authorDiv);
    quoteP.replaceWith(pullquote);
    if (headshotP) headshotP.remove();
    el.remove();
  });

  // YouTube video ID mapping (page path -> YouTube video ID)
  const VIDEO_MAP = {
    '/who-we-are/our-stories/immunologys-next-frontier': 'uIxRed5Xegw',
    '/who-we-are/our-stories/inside-dream-initiative': 'T_up1joThrA',
    '/who-we-are/our-stories/the-power-love-in-ibd': 'nzUMv9J4xnw',
    '/who-we-are/our-stories/green-chemistry-cleaner-faster-chemical-reactions': 'dCKpxMcTssg',
    '/who-we-are/our-stories/everyones-talking-about-data-science': 'bMKSaF6sflc',
    '/who-we-are/our-stories/rebuilding-puerto-rico-one-community-health-center-at-a-time': 'D_aAxXb1v3g',
    '/who-we-are/our-stories/unlocking-the-next-level-of-protein-degradation': 'e4ZFsAuOmoQ',
    '/who-we-are/our-stories/discovery-files-vision-for-blood-cancer-patients': 'cOIxTT89eXE',
    '/who-we-are/our-stories/navigating-ulcerative-colitis-as-a-child': '9dPIZT6-2so',
  };

  // Build video embed from thumbnail + title + optional subtitle + watch pattern
  function findVideoPattern(elements) {
    for (let i = 0; i < elements.length - 2; i += 1) {
      const el1 = elements[i];
      const isVideoImg = el1.tagName === 'P'
        && el1.querySelector('img')
        && el1.textContent.trim() === '';
      if (!isVideoImg) { /* skip */ } else {
        // Look ahead for the "watch" element (could be at i+2, i+3, or i+4)
        let watchIdx = -1;
        const maxLook = Math.min(i + 5, elements.length);
        for (let j = i + 2; j < maxLook; j += 1) {
          const candidate = elements[j];
          if (candidate.tagName === 'P'
            && candidate.textContent.trim().toLowerCase().startsWith('watch')) {
            watchIdx = j;
            break;
          }
          if (candidate.tagName !== 'P' || candidate.querySelector('img')) break;
        }
        if (watchIdx < 0) { /* no watch found */ } else {
          const titleEl = elements[i + 1];
          const validTitle = titleEl.tagName === 'P'
            && !titleEl.querySelector('img')
            && titleEl.textContent.trim().length >= 3
            && titleEl.textContent.trim().length <= 200;
          if (validTitle) {
            return { imgIdx: i, watchIdx, titleEl };
          }
        }
      }
    }
    return null;
  }

  const updatedChildren = [...dcw.children];
  const videoMatch = findVideoPattern(updatedChildren);
  if (videoMatch) {
    const { imgIdx, watchIdx, titleEl } = videoMatch;
    const el1 = updatedChildren[imgIdx];
    const watchEl = updatedChildren[watchIdx];
    const embed = document.createElement('div');
    embed.className = 'article-video-embed';

    const pic = el1.querySelector('picture') || el1.querySelector('img');
    embed.append(pic);

    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';

    const heading = document.createElement('h2');
    heading.textContent = titleEl.textContent.trim();

    const btn = document.createElement('button');
    btn.className = 'video-play-btn';
    btn.textContent = watchEl.textContent.trim();

    overlay.append(heading, btn);
    embed.append(overlay);

    // Remove all elements between image and watch (inclusive)
    el1.replaceWith(embed);
    for (let j = imgIdx + 1; j <= watchIdx; j += 1) {
      updatedChildren[j].remove();
    }

    // Also remove the duplicate h5 + subtitle that follows the watch pattern
    const nextAfterWatch = embed.nextElementSibling;
    if (nextAfterWatch?.tagName === 'H5') {
      const afterH5 = nextAfterWatch.nextElementSibling;
      if (afterH5?.tagName === 'P'
        && !afterH5.querySelector('img')
        && afterH5.textContent.trim().length < 200) {
        afterH5.remove();
      }
      nextAfterWatch.remove();
    }

    // Add click-to-play: load YouTube iframe when play button is clicked
    const pagePath = window.location.pathname.replace(/\.html$/, '');
    const videoId = VIDEO_MAP[pagePath];
    if (videoId) {
      embed.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        iframe.style.position = 'absolute';
        iframe.style.inset = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        embed.style.position = 'relative';
        embed.innerHTML = '';
        embed.style.aspectRatio = '16 / 9';
        embed.append(iframe);
      });
      embed.style.cursor = 'pointer';
    }
  }

  // Create sidebar layout with Related Content (metadata-driven)
  const relatedMeta = document.querySelector('meta[name="related-content"]');
  const cardsRelatedSection = bodySection.nextElementSibling;
  const hasCardsSection = cardsRelatedSection
    && cardsRelatedSection.classList.contains('cards-related-container');

  // Only create sidebar if Related Content metadata exists
  if (relatedMeta || hasCardsSection) {
    bodySection.classList.add('article-with-sidebar');

    const sidebar = document.createElement('aside');
    sidebar.className = 'article-sidebar';

    if (hasCardsSection) {
      // Move authored cards-related section into sidebar
      while (cardsRelatedSection.firstElementChild) {
        sidebar.append(cardsRelatedSection.firstElementChild);
      }
      cardsRelatedSection.remove();
    } else if (relatedMeta) {
      // Create dynamic sidebar from metadata
      const heading = document.createElement('div');
      heading.className = 'default-content-wrapper';
      heading.innerHTML = '<p>Related Content</p>';

      const wrapper = document.createElement('div');
      wrapper.className = 'cards-related-wrapper';
      const blockEl = document.createElement('div');
      blockEl.className = 'cards-related block';
      blockEl.setAttribute('data-block-name', 'cards-related');
      blockEl.setAttribute('data-block-status', '');
      wrapper.append(blockEl);

      sidebar.append(heading, wrapper);
    }

    bodySection.append(sidebar);
  }

  // Decorate media inquiries in ALL sections after the hero (not just the first body section)
  // This handles pages where content is split across multiple sections
  let siblingSection = bodySection.nextElementSibling;
  while (siblingSection) {
    if (siblingSection.classList.contains('section')) {
      const sibDcw = siblingSection.querySelector('.default-content-wrapper');
      if (sibDcw) {
        // Standard pattern: <p><strong>Media inquiries:</strong>...</p>
        sibDcw.querySelectorAll('p').forEach((p) => {
          const strong = p.querySelector('strong');
          if (strong && strong.textContent.trim().toLowerCase().includes('media inquiries')) {
            if (!p.previousElementSibling?.matches('hr')) {
              p.before(document.createElement('hr'));
            }
            p.classList.add('article-media-inquiries');
          }
        });

        // Alternate pattern: <h3>Media inquiries:</h3><p>Email:...</p>
        sibDcw.querySelectorAll('h3').forEach((h3) => {
          if (h3.textContent.trim().toLowerCase().includes('media inquiries')) {
            const nextP = h3.nextElementSibling;
            if (nextP?.tagName === 'P' && nextP.querySelector('a[href^="mailto:"]')) {
              // Merge h3 + p into a single styled paragraph
              const merged = document.createElement('p');
              merged.className = 'article-media-inquiries';
              merged.innerHTML = `<strong>${h3.textContent.trim()}</strong> ${nextP.innerHTML}`;
              if (!h3.previousElementSibling?.matches('hr')) {
                h3.before(document.createElement('hr'));
              }
              h3.replaceWith(merged);
              nextP.remove();
            }
          }
        });
      }
    }
    siblingSection = siblingSection.nextElementSibling;
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
