import { loadCSS } from '../../scripts/aem.js';

/**
 * Decorates article body content after hero-article sections.
 * Converts consecutive image paragraphs into a carousel and
 * video thumbnail patterns into a video embed overlay.
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
    const parts = el.innerHTML.split(/<br\s*\/?>/i).map((pt) => pt.replace(/<[^>]+>/g, '').trim());
    if (parts.length < 2 || parts[0].length > 50 || parts[0].length < 3) return false;
    return /^[A-Z]/.test(parts[0]);
  }

  const pqElements = [...dcw.children];
  pqElements.forEach((el, i) => {
    if (i === 0 || !isAuthorAttribution(el)) return;

    const parts = el.innerHTML.split(/<br\s*\/?>/i).map((pt) => pt.replace(/<[^>]+>/g, '').trim());
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
      const headingEl = document.createElement('div');
      headingEl.className = 'default-content-wrapper';
      headingEl.innerHTML = '<p>Related Content</p>';

      const wrapper = document.createElement('div');
      wrapper.className = 'cards-related-wrapper';
      const blockEl = document.createElement('div');
      blockEl.className = 'cards-related block';
      blockEl.setAttribute('data-block-name', 'cards-related');
      blockEl.setAttribute('data-block-status', '');
      wrapper.append(blockEl);

      sidebar.append(headingEl, wrapper);
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
 * Injects the published date into hero-article blocks.
 * Reads from page metadata first, falls back to query-index.
 * @param {Element} main The main element
 */
async function addArticleDate(main) {
  const heroMeta = main.querySelector('.hero-article .hero-article-meta');
  if (!heroMeta) return;

  if (heroMeta.querySelector('.hero-article-date')) return;

  // Try published-date metadata first (works in all preview environments)
  const publishedMeta = document.querySelector('meta[name="published-date"]');
  let formatted = publishedMeta?.content;

  // Fall back to query-index if no metadata
  if (!formatted) {
    try {
      const resp = await fetch('/query-index.json');
      if (resp.ok) {
        const { data } = await resp.json();
        if (data) {
          let { pathname } = window.location;
          if (pathname.endsWith('.html')) pathname = pathname.slice(0, -5);
          if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);
          if (pathname.startsWith('/content')) pathname = pathname.replace(/^\/content/, '');

          const entry = data.find((e) => e.path === pathname);
          if (entry?.['last-Modified']) {
            const date = new Date(entry['last-Modified'] * 1000);
            formatted = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
          }
        }
      }
    } catch {
      // silently fail - date is non-critical
    }
  }

  if (!formatted) return;

  const dateDiv = document.createElement('div');
  dateDiv.className = 'hero-article-date';
  dateDiv.textContent = formatted;

  heroMeta.prepend(dateDiv);
}

/**
 * Decorates the stories-article template.
 * @param {Element} doc The document element
 */
export default async function decorate(doc) {
  const main = doc.querySelector('main');
  if (!main) return;

  decorateArticleBody(main);

  // Load template-specific lazy CSS
  loadCSS(`${window.hlx.codeBasePath}/templates/stories-article/stories-article.css`);

  // Add article date after hero-article block is fully decorated
  const heroMeta = main.querySelector('.hero-article .hero-article-meta');
  if (heroMeta) {
    addArticleDate(main);
  } else {
    const observer = new MutationObserver(() => {
      if (main.querySelector('.hero-article .hero-article-meta')) {
        observer.disconnect();
        addArticleDate(main);
      }
    });
    observer.observe(main, { childList: true, subtree: true });
  }
}
