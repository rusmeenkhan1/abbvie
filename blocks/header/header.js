import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const isDesktop = window.matchMedia('(min-width: 900px)');

/* Nested sub-navigation data - third-level items not supported by EDS content model */
const NESTED_NAV = {
  'Our Principles': [
    { text: 'Positions & Views', href: '/who-we-are/our-principles/positions-views' },
    { text: 'Equity, Equality, Diversity & Inclusion', href: '/who-we-are/our-principles/equity-equality-inclusion-diversity' },
  ],
  'Operating with Integrity': [
    { text: 'Protecting Human Rights and Workplace Safety', href: '/who-we-are/operating-with-integrity/protecting-human-rights-and-workplace-safety' },
    { text: 'Transparency in Payments', href: '/who-we-are/operating-with-integrity/transparency-in-payment' },
    { text: 'Responsible Supply Chain', href: '/who-we-are/operating-with-integrity/responsible-supply-chain' },
    { text: "AbbVie's Code of Conduct", href: '/who-we-are/operating-with-integrity/abbvies-code-of-conduct' },
  ],
  'Our Stories': [
    { text: 'Podcasts', href: '/who-we-are/our-stories/the-persistence-lab-podcasts' },
  ],
  'Brand Partnerships': [
    { text: 'Chicago Cubs', href: '/who-we-are/brand-partnerships/cubs' },
    { text: 'Major League Baseball', href: '/who-we-are/brand-partnerships/major-league-baseball' },
  ],
  'Areas of Focus': [
    { text: 'Immunology', href: '/science/areas-of-focus/immunology' },
    { text: 'Oncology', href: '/science/areas-of-focus/oncology' },
    { text: 'Neuroscience', href: '/science/areas-of-focus/neuroscience' },
    { text: 'Eye Care', href: '/science/areas-of-focus/eye-care' },
    { text: 'Aesthetics', href: '/science/areas-of-focus/aesthetics' },
    { text: 'Other Specialties', href: '/science/areas-of-focus/other-specialties' },
  ],
  'Areas of Innovation': [
    { text: 'AI & Data Convergence', href: '/science/areas-of-innovation/ai-and-data-convergence' },
    { text: 'Genomics', href: '/science/areas-of-innovation/genomics' },
    { text: 'Patient-Focused Drug Development', href: '/science/areas-of-innovation/patient-focused-drug-development' },
    { text: 'Precision Medicine', href: '/science/areas-of-innovation/precision-medicine' },
    { text: 'Therapeutic Modalities & Platforms', href: '/science/areas-of-innovation/therapeutic-modalities-and-platforms' },
  ],
  'Our People': [
    { text: 'Community of Science', href: '/science/our-people/community-of-science' },
    { text: 'Our R&D Leaders', href: '/science/our-people/our-rd-leaders' },
  ],
  'Partner with Us': [
    { text: 'Partnering Days', href: '/science/partner-with-us/partnering-days' },
    { text: 'AbbVie Ventures', href: '/science/partner-with-us/abbvie-ventures' },
  ],
  'Clinical Trials': [
    { text: 'Investigator-Initiated Studies', href: '/science/clinical-trials/investigator-initiated-studies' },
  ],
  'Independent Educational Grants': [
    { text: 'How to Apply', href: '/science/independent-educational-grants/how-to-apply' },
    { text: 'Request Types', href: '/science/independent-educational-grants/request-types' },
    { text: 'Requestor Training Guide', href: '/science/independent-educational-grants/requestor-training-guide' },
    { text: 'Grants and Contribution Disclosures', href: '/science/independent-educational-grants/grants-and-contribution-disclosures' },
  ],
  'Patient Support': [
    { text: 'Patient Assistance', href: '/patients/patient-support/patient-assistance' },
  ],
  Opportunities: [
    { text: 'Research & Development', href: '/join-us/opportunities/research-and-development' },
    { text: 'Commercial', href: '/join-us/opportunities/commercial' },
    { text: 'Corporate', href: '/join-us/opportunities/corporate' },
    { text: 'Operations', href: '/join-us/opportunities/operations' },
    { text: 'Allergan Aesthetics', href: '/join-us/opportunities/allergan-aesthetics' },
  ],
  'Life at AbbVie': [
    { text: 'Benefits', href: '/join-us/life-at-abbvie/benefits' },
    { text: 'Learning & Development', href: '/join-us/life-at-abbvie/learning-and-development' },
    { text: 'Well-Being in the Workplace', href: '/join-us/life-at-abbvie/well-being-in-the-workplace' },
    { text: 'Employee Resource Groups', href: '/join-us/life-at-abbvie/employee-resource-groups' },
  ],
  'Students & New Graduates': [
    { text: 'New Graduates & Entry-Level positions', href: '/join-us/student-and-new-graduates/new-graduates-and-entry-level-positions' },
  ],
  'AbbVie Foundation': [
    { text: 'Addressing Systemic Barriers', href: '/sustainability/abbvie-foundation/addressing-systemic-barriers' },
    { text: 'Innovative Impact', href: '/sustainability/abbvie-foundation/innovative-impact' },
  ],
  'Environmental, Social & Governance': [
    { text: 'Resources', href: '/sustainability/environmental-social-and-governance/resources' },
  ],
};

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

function decorateNavSections(navSections, nav) {
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
        const a = subLi.querySelector('a');
        if (!a) return;
        const itemName = a.textContent.trim();
        const nestedChildren = NESTED_NAV[itemName];

        if (nestedChildren) {
          // Expandable item with sub-children from NESTED_NAV
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

          nestedChildren.forEach((child) => {
            const childLink = document.createElement('a');
            childLink.href = child.href;
            childLink.className = 'mega-expand-link';
            childLink.textContent = child.text;
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

      // Promo section (light blue)
      const promoDiv = document.createElement('div');
      promoDiv.className = 'mega-promo';

      const promoInfo = document.createElement('div');
      promoInfo.className = 'mega-promo-info';

      const promoTitle = document.createElement('h4');
      promoTitle.textContent = btn.textContent.trim();
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

      promoDiv.append(promoInfo);
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

  // Sections / Nav items
  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    decorateNavSections(navSections, nav);
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
