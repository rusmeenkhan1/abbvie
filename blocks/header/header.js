import { getMetadata, toClassName } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const isDesktop = window.matchMedia('(min-width: 900px)');

/**
 * Determines if a link should open externally.
 * External: absolute URLs to different domains, PDF files.
 * @param {string} href The link href
 * @returns {boolean}
 */
function isExternalLink(href) {
  if (!href) return false;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return true;
    if (url.pathname.toLowerCase().endsWith('.pdf')) return true;
  } catch { /* treat as internal */ }
  return false;
}

/**
 * Parses mega-promo blocks from the nav fragment into a lookup map.
 * Each block's variant class identifies which nav section it belongs to.
 * Removes the promo section(s) from the DOM after parsing.
 *
 * Block row structure (5 rows):
 *   Row 0: quick-link-1 | quick-link-2
 *   Row 1: card-tag      | card-title
 *   Row 2: card-cta-link | (empty)
 *   Row 3: counter-eyebrow | counter-number+suffix
 *   Row 4: counter-description | (empty)
 *
 * @param {HTMLElement} nav The nav element
 * @returns {Map<string, object>} kebab-case section name -> promo data
 */
function parseMegaPromos(nav) {
  const promos = new Map();
  const promoSections = nav.querySelectorAll('.section.mega-promo-container');

  promoSections.forEach((section) => {
    section.querySelectorAll('.mega-promo.block').forEach((block) => {
      const variantClass = [...block.classList].find(
        (c) => c !== 'mega-promo' && c !== 'block',
      );
      if (!variantClass) return;

      const rows = [...block.querySelectorAll(':scope > div')];
      if (rows.length < 5) return;

      const cellText = (rowIdx, colIdx) => {
        const cell = rows[rowIdx]?.children[colIdx];
        return cell?.textContent?.trim() || '';
      };

      // Row 0: Quick links
      const quickLinks = [];
      [...(rows[0]?.children || [])].forEach((cell) => {
        const a = cell.querySelector('a');
        if (a) {
          const linkHref = a.getAttribute('href');
          const ql = { text: a.textContent.trim(), href: linkHref };
          if (isExternalLink(linkHref)) ql.external = true;
          quickLinks.push(ql);
        }
      });

      // Row 1: Card tag (col 0) + card title (col 1)
      const cardTag = cellText(1, 0);
      const cardTitle = cellText(1, 1);

      // Row 2: Card CTA link (col 0)
      const ctaLink = rows[2]?.children[0]?.querySelector('a');
      const cardCta = ctaLink?.textContent?.trim() || '';
      const cardHref = ctaLink?.getAttribute('href') || '';

      // Row 3: Counter eyebrow (col 0) + number+suffix (col 1)
      const counterEyebrow = cellText(3, 0);
      const counterRaw = cellText(3, 1);
      const match = counterRaw.match(/^(\d+)(.*)$/);
      const counterNumber = match ? match[1] : counterRaw;
      const counterSuffix = match ? match[2] : '';

      // Row 4: Counter description (col 0)
      const counterDescription = cellText(4, 0);

      promos.set(variantClass, {
        quickLinks,
        card: {
          ...(cardTag && { tag: cardTag }),
          title: cardTitle,
          cta: cardCta,
          href: cardHref,
        },
        counter: {
          eyebrow: counterEyebrow,
          number: counterNumber,
          suffix: counterSuffix,
          description: counterDescription,
        },
      });
    });

    section.remove();
  });

  return promos;
}

function closeAllMenus(nav) {
  const navSections = nav.querySelector('.nav-sections');
  if (!navSections) return;
  navSections.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.remove('active');
    const btn = item.querySelector(':scope > button');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
  nav.classList.remove('mega-open');
}

function closeMobileMenu(nav) {
  nav.setAttribute('aria-expanded', 'false');
  document.body.style.overflowY = '';
  const hamburger = nav.querySelector('.nav-hamburger button');
  if (hamburger) hamburger.setAttribute('aria-label', 'Open navigation');
  // reset mobile submenu
  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.classList.remove('submenu-active');
    navSections.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.remove('mobile-submenu-open');
    });
  }
}

function openMobileMenu(nav) {
  nav.setAttribute('aria-expanded', 'true');
  document.body.style.overflowY = 'hidden';
  const hamburger = nav.querySelector('.nav-hamburger button');
  if (hamburger) hamburger.setAttribute('aria-label', 'Close navigation');
}

function handleEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    if (!nav) return;
    if (isDesktop.matches) {
      closeAllMenus(nav);
    } else {
      closeMobileMenu(nav);
    }
  }
}

function buildSearch(nav, searchLink) {
  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'nav-search';

  const searchBtn = document.createElement('button');
  searchBtn.className = 'nav-search-btn';
  searchBtn.setAttribute('aria-label', 'Search');
  searchBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>`;

  const searchPanel = document.createElement('div');
  searchPanel.className = 'nav-search-panel';
  searchPanel.innerHTML = `
    <div class="search-panel-inner">
      <label for="nav-search-input" class="search-label">Search</label>
      <div class="search-input-wrap">
        <input type="search" id="nav-search-input" placeholder="" autocomplete="off">
        <button class="search-submit" aria-label="Submit search">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>
    </div>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'nav-search-close';
  closeBtn.setAttribute('aria-label', 'Close search');
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;

  searchBtn.addEventListener('click', () => {
    const isOpen = nav.classList.contains('search-open');
    closeAllMenus(nav);
    if (!isOpen) {
      nav.classList.add('search-open');
      searchPanel.querySelector('input')?.focus();
    } else {
      nav.classList.remove('search-open');
    }
  });

  closeBtn.addEventListener('click', () => {
    nav.classList.remove('search-open');
  });

  searchPanel.querySelector('.search-submit')?.addEventListener('click', () => {
    const val = searchPanel.querySelector('input')?.value;
    if (val && searchLink) {
      window.location.href = `${searchLink}?q=${encodeURIComponent(val)}`;
    }
  });

  searchPanel.querySelector('input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value;
      if (val && searchLink) {
        window.location.href = `${searchLink}?q=${encodeURIComponent(val)}`;
      }
    }
  });

  searchWrapper.append(searchBtn, closeBtn, searchPanel);
  return searchWrapper;
}

function decorateNavSections(navSections, nav, promoMap) {
  const ul = navSections.querySelector(':scope .default-content-wrapper > ul');
  if (!ul) return;

  [...ul.children].forEach((li) => {
    li.classList.add('nav-item');

    // Find the main link - may be direct child or wrapped in <p>
    let link = li.querySelector(':scope > a');
    const linkP = li.querySelector(':scope > p > a');
    if (!link && linkP) link = linkP;
    const subUl = li.querySelector(':scope > ul');
    // Description is the last <p> that doesn't contain a link
    const allPs = [...li.querySelectorAll(':scope > p')];
    const desc = allPs.find((p) => !p.querySelector('a'));

    if (link && subUl) {
      // has dropdown
      li.classList.add('nav-drop');

      // Replace the top-level link with a button
      const btn = document.createElement('button');
      btn.className = 'nav-item-btn';
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = `<span>${link.textContent}</span>`;
      btn.dataset.href = link.href;
      // Remove the paragraph wrapper if exists
      const linkParent = link.closest('p');
      if (linkParent && linkParent.parentElement === li) {
        li.replaceChild(btn, linkParent);
      } else {
        li.replaceChild(btn, link);
      }

      // Wrap sub-items in a mega-menu panel
      const megaPanel = document.createElement('div');
      megaPanel.className = 'mega-panel';

      // Sub-links section
      const subLinksDiv = document.createElement('div');
      subLinksDiv.className = 'mega-sub-links';
      const subLinksInner = document.createElement('div');
      subLinksInner.className = 'mega-sub-links-inner';

      [...subUl.children].forEach((subLi) => {
        const a = subLi.querySelector(':scope > a');
        if (!a) return;
        const itemName = a.textContent.trim();
        const nestedUl = subLi.querySelector(':scope > ul');

        if (nestedUl) {
          // Expandable item with sub-children from authored content
          const expandItem = document.createElement('div');
          expandItem.className = 'mega-expand-item';

          const expandBtn = document.createElement('button');
          expandBtn.className = 'mega-expand-btn';
          expandBtn.setAttribute('aria-expanded', 'false');
          expandBtn.innerHTML = `<span class="mega-expand-icon"></span><span>${itemName}</span>`;

          const expandPanel = document.createElement('div');
          expandPanel.className = 'mega-expand-panel';

          const goToLink = document.createElement('a');
          goToLink.href = a.href;
          goToLink.className = 'mega-expand-goto';
          goToLink.innerHTML = 'GO TO PAGE <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';
          expandPanel.append(goToLink);

          [...nestedUl.children].forEach((nestedLi) => {
            const nestedA = nestedLi.querySelector('a');
            if (!nestedA) return;
            const childLink = document.createElement('a');
            childLink.href = nestedA.href;
            childLink.className = 'mega-expand-link';
            childLink.textContent = nestedA.textContent.trim();
            expandPanel.append(childLink);
          });

          expandBtn.addEventListener('click', () => {
            const isExpanded = expandItem.classList.contains('expanded');
            // Close other expanded items in this mega panel
            const parent = expandItem.closest('.mega-sub-links-inner');
            if (parent) {
              parent.querySelectorAll('.mega-expand-item.expanded').forEach((item) => {
                item.classList.remove('expanded');
                item.querySelector('.mega-expand-btn')?.setAttribute('aria-expanded', 'false');
              });
            }
            if (!isExpanded) {
              expandItem.classList.add('expanded');
              expandBtn.setAttribute('aria-expanded', 'true');
            }
          });

          expandItem.append(expandBtn, expandPanel);
          subLinksInner.append(expandItem);
        } else {
          const subItem = document.createElement('a');
          subItem.href = a.href;
          subItem.className = 'mega-link';
          subItem.textContent = itemName;
          subLinksInner.append(subItem);
        }
      });
      subLinksDiv.append(subLinksInner);

      // Close button for desktop
      const closeBtn = document.createElement('button');
      closeBtn.className = 'mega-close';
      closeBtn.setAttribute('aria-label', 'Close menu');
      closeBtn.innerHTML = '<span>CLOSE</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      subLinksDiv.append(closeBtn);

      // Promo section (light blue) - 3-column: info + card + counter
      const sectionName = btn.textContent.trim();
      const promoData = promoMap.get(toClassName(sectionName));
      const promoDiv = document.createElement('div');
      promoDiv.className = 'mega-promo';

      const promoGrid = document.createElement('div');
      promoGrid.className = 'mega-promo-grid';

      // Column 1: Info section
      const promoInfo = document.createElement('div');
      promoInfo.className = 'mega-promo-info';

      const promoTitle = document.createElement('h4');
      promoTitle.textContent = sectionName;
      promoInfo.append(promoTitle);

      if (desc) {
        const promoDesc = document.createElement('p');
        promoDesc.textContent = desc.textContent;
        promoInfo.append(promoDesc);
        desc.remove();
      }

      const goToPage = document.createElement('a');
      goToPage.href = btn.dataset.href;
      goToPage.className = 'mega-go-to-page';
      goToPage.textContent = 'GO TO PAGE';
      promoInfo.append(goToPage);

      // Quick links
      if (promoData?.quickLinks) {
        const quickLinksDiv = document.createElement('div');
        quickLinksDiv.className = 'mega-quick-links';
        promoData.quickLinks.forEach((ql) => {
          const qlLink = document.createElement('a');
          qlLink.href = ql.href;
          qlLink.className = 'mega-quick-link';
          if (ql.external) qlLink.target = '_blank';
          qlLink.innerHTML = `<span>${ql.text}</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ql.external ? '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>' : '<polyline points="9 6 15 12 9 18"/>'}</svg>`;
          quickLinksDiv.append(qlLink);
        });
        promoInfo.append(quickLinksDiv);
      }

      promoGrid.append(promoInfo);

      // Column 2: Featured card
      if (promoData?.card) {
        const cardDiv = document.createElement('a');
        cardDiv.href = promoData.card.href;
        cardDiv.className = 'mega-promo-card';

        const cardContent = document.createElement('div');
        cardContent.className = 'mega-promo-card-content';

        if (promoData.card.tag) {
          const cardTag = document.createElement('span');
          cardTag.className = 'mega-promo-card-tag';
          cardTag.textContent = promoData.card.tag;
          cardContent.append(cardTag);
        }

        const cardTitle = document.createElement('h4');
        cardTitle.className = 'mega-promo-card-title';
        cardTitle.textContent = promoData.card.title;
        cardContent.append(cardTitle);

        const cardCta = document.createElement('span');
        cardCta.className = 'mega-promo-card-cta';
        cardCta.innerHTML = `${promoData.card.cta} <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
        cardContent.append(cardCta);

        cardDiv.append(cardContent);
        promoGrid.append(cardDiv);
      }

      // Column 3: Stats counter
      if (promoData?.counter) {
        const counterDiv = document.createElement('div');
        counterDiv.className = 'mega-promo-counter';

        const counterEyebrow = document.createElement('span');
        counterEyebrow.className = 'mega-counter-eyebrow';
        counterEyebrow.textContent = promoData.counter.eyebrow;
        counterDiv.append(counterEyebrow);

        const counterNumber = document.createElement('div');
        counterNumber.className = 'mega-counter-number';
        counterNumber.innerHTML = `<span class="mega-counter-value">${promoData.counter.number}</span><span class="mega-counter-suffix">${promoData.counter.suffix}</span>`;
        counterDiv.append(counterNumber);

        const counterDesc = document.createElement('p');
        counterDesc.className = 'mega-counter-desc';
        counterDesc.textContent = promoData.counter.description;
        counterDiv.append(counterDesc);

        promoGrid.append(counterDiv);
      }

      promoDiv.append(promoGrid);
      megaPanel.append(subLinksDiv, promoDiv);
      subUl.remove();
      li.append(megaPanel);

      // Desktop: click to toggle mega menu
      btn.addEventListener('click', () => {
        if (isDesktop.matches) {
          const isActive = li.classList.contains('active');
          closeAllMenus(nav);
          nav.classList.remove('search-open');
          if (!isActive) {
            li.classList.add('active');
            btn.setAttribute('aria-expanded', 'true');
            nav.classList.add('mega-open');
          }
        } else {
          // Mobile: open submenu
          li.classList.add('mobile-submenu-open');
          navSections.classList.add('submenu-active');
        }
      });

      closeBtn.addEventListener('click', () => {
        closeAllMenus(nav);
      });
    } else if (link) {
      // simple link item - unwrap from <p> if needed
      link.classList.add('nav-item-link');
      const linkParent = link.closest('p');
      if (linkParent && linkParent.parentElement === li) {
        li.replaceChild(link, linkParent);
      }
    }
  });
}

function buildMobileBackButton(navSections) {
  const backBtn = document.createElement('button');
  backBtn.className = 'nav-back-btn';
  backBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><span>BACK</span>';
  backBtn.addEventListener('click', () => {
    navSections.classList.remove('submenu-active');
    navSections.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.remove('mobile-submenu-open');
    });
  });
  navSections.prepend(backBtn);
}

export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-expanded', 'false');
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  // Brand / Logo
  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    const brandLink = navBrand.querySelector('a');
    if (brandLink) {
      brandLink.className = 'nav-brand-link';
      brandLink.setAttribute('aria-label', 'AbbVie Home');
      // Remove button classes added by decorateButtons
      brandLink.classList.remove('button', 'primary', 'secondary', 'accent');
      const p = brandLink.closest('p');
      if (p) {
        p.className = '';
        p.classList.remove('button-wrapper');
      }
      // Replace processed picture element with direct SVG img
      const picture = brandLink.querySelector('picture');
      if (picture) {
        const img = document.createElement('img');
        img.src = '/icons/abbvie-logo.svg';
        img.alt = 'AbbVie';
        img.width = 88;
        img.height = 16;
        picture.replaceWith(img);
      }
    }
  }

  // Parse and remove mega-promo blocks before processing nav sections
  const promoMap = parseMegaPromos(nav);

  // Sections / Nav items
  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    decorateNavSections(navSections, nav, promoMap);
    buildMobileBackButton(navSections);
  }

  // Tools (search)
  const navTools = nav.querySelector('.nav-tools');
  let searchHref = '/search';
  if (navTools) {
    const searchA = navTools.querySelector('a');
    if (searchA) searchHref = searchA.href;
    navTools.remove();
  }

  // Build search
  const searchEl = buildSearch(nav, searchHref);

  // Build hamburger
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
    <svg class="icon-hamburger" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="4" y1="7" x2="20" y2="7"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="17" x2="20" y2="17"/>
    </svg>
    <svg class="icon-close" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>`;

  hamburger.querySelector('button').addEventListener('click', () => {
    const expanded = nav.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closeMobileMenu(nav);
    } else {
      nav.classList.remove('search-open');
      closeAllMenus(nav);
      openMobileMenu(nav);
    }
  });

  // Build the header bar - on desktop this contains brand + nav sections + right tools
  const headerBar = document.createElement('div');
  headerBar.className = 'nav-header-bar';
  headerBar.append(navBrand);
  // Move nav-sections into the header bar so they flow inline on desktop
  if (navSections) headerBar.append(navSections);

  // Build utility nav buttons (MORE + GLOBAL) - desktop only
  const utilityNav = document.createElement('div');
  utilityNav.className = 'nav-utility';

  const moreBtn = document.createElement('button');
  moreBtn.className = 'nav-utility-btn nav-more-btn';
  moreBtn.setAttribute('aria-label', 'More - Quick Links');
  moreBtn.innerHTML = '<img src="/icons/icon-dot-menu.svg" alt="" aria-hidden="true" width="20" height="20"><span>MORE</span>';

  const globalBtn = document.createElement('button');
  globalBtn.className = 'nav-utility-btn nav-global-btn';
  globalBtn.setAttribute('aria-label', 'Global');
  globalBtn.innerHTML = '<img src="/icons/icon-globe.svg" alt="" aria-hidden="true" width="20" height="20"><span>GLOBAL</span>';

  utilityNav.append(moreBtn, globalBtn);

  const headerRight = document.createElement('div');
  headerRight.className = 'nav-header-right';
  headerRight.append(utilityNav, searchEl, hamburger);
  headerBar.append(headerRight);

  // Assemble nav
  nav.prepend(headerBar);

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) {
      closeAllMenus(nav);
      nav.classList.remove('search-open');
    }
  });

  window.addEventListener('keydown', handleEscape);

  // Handle resize
  isDesktop.addEventListener('change', () => {
    closeAllMenus(nav);
    closeMobileMenu(nav);
    nav.classList.remove('search-open');
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
