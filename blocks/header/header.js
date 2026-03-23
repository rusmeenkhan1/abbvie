import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import NAV_MEGA_MENU from './nav-mega-menu.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeMegaMenu(nav) {
  const navSections = nav.querySelector('.nav-sections');
  if (!navSections) return;
  navSections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', false);
  });
  // Remove mega-menu overlay
  const overlay = nav.closest('.nav-wrapper')?.querySelector('.mega-menu-overlay');
  if (overlay) overlay.remove();
}

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    if (isDesktop.matches) {
      closeMegaMenu(nav);
    } else {
      const navSections = nav.querySelector('.nav-sections');
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    if (isDesktop.matches) {
      closeMegaMenu(nav);
    } else {
      const navSections = nav.querySelector('.nav-sections');
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    closeMegaMenu(focused.closest('nav'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Get mega-menu data for a nav section.
 * Reads from the nav DOM if nested lists exist (content-driven),
 * otherwise falls back to the nav-mega-menu.js data module.
 * @param {Element} navSection The li element
 * @returns {Object} { label, href, description, items[] }
 */
function getMegaMenuData(navSection) {
  let link = navSection.querySelector(':scope > a');
  if (!link) link = navSection.querySelector(':scope > p > a');
  const label = link ? link.textContent.trim() : '';
  const href = link ? link.getAttribute('href') : '';

  // Try content-driven approach: nested <ul> and <p> in the nav DOM
  const nestedUl = navSection.querySelector(':scope > ul');
  if (nestedUl) {
    const descP = navSection.querySelector(':scope > p');
    const description = descP ? descP.textContent.trim() : '';
    const items = [];
    nestedUl.querySelectorAll(':scope > li').forEach((li) => {
      const a = li.querySelector('a');
      if (a) {
        items.push({ text: a.textContent.trim(), href: a.getAttribute('href') });
      }
    });
    return {
      label, href, description, items,
    };
  }

  // Fallback: use the data module
  const fallback = NAV_MEGA_MENU[label];
  if (fallback) {
    return {
      label,
      href: fallback.href,
      description: fallback.description,
      items: fallback.items,
    };
  }

  return {
    label, href, description: '', items: [],
  };
}

/**
 * Build mega-menu panel for a nav section
 */
function buildMegaMenu(navSection, navWrapper) {
  const data = getMegaMenuData(navSection);
  if (!data.items.length) return;

  // Remove existing mega-menu overlay
  const existing = navWrapper.querySelector('.mega-menu-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'mega-menu-overlay';

  // Sub-nav links section (white background)
  const subNav = document.createElement('div');
  subNav.className = 'mega-menu-subnav';

  const subNavInner = document.createElement('div');
  subNavInner.className = 'mega-menu-subnav-inner';

  const linksGrid = document.createElement('ul');
  linksGrid.className = 'mega-menu-links';
  data.items.forEach((item) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.text;
    li.append(a);
    linksGrid.append(li);
  });
  subNavInner.append(linksGrid);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mega-menu-close';
  closeBtn.setAttribute('aria-label', 'Close menu');
  closeBtn.innerHTML = '<span>CLOSE</span> <span class="mega-menu-close-icon">\u00D7</span>';
  closeBtn.addEventListener('click', () => {
    const nav = navWrapper.querySelector('nav');
    closeMegaMenu(nav);
  });
  subNavInner.append(closeBtn);

  subNav.append(subNavInner);

  // Content section (lavender background)
  const content = document.createElement('div');
  content.className = 'mega-menu-content';

  const contentInner = document.createElement('div');
  contentInner.className = 'mega-menu-content-inner';

  const contentText = document.createElement('div');
  contentText.className = 'mega-menu-content-text';

  const heading = document.createElement('h3');
  heading.textContent = data.label;
  contentText.append(heading);

  const desc = document.createElement('p');
  desc.textContent = data.description;
  contentText.append(desc);

  const goLink = document.createElement('a');
  goLink.href = data.href;
  goLink.className = 'mega-menu-go-link';
  goLink.textContent = 'GO TO PAGE';
  contentText.append(goLink);

  contentInner.append(contentText);
  content.append(contentInner);

  overlay.append(subNav);
  overlay.append(content);
  navWrapper.append(overlay);
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  if (navSections) {
    const navDrops = navSections.querySelectorAll('.nav-drop');
    if (isDesktop.matches) {
      navDrops.forEach((drop) => {
        if (!drop.hasAttribute('tabindex')) {
          drop.setAttribute('tabindex', 0);
          drop.addEventListener('focus', focusNavSection);
        }
      });
    } else {
      navDrops.forEach((drop) => {
        drop.removeAttribute('tabindex');
        drop.removeEventListener('focus', focusNavSection);
      });
    }
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  if (fragment) {
    while (fragment.firstElementChild) nav.append(fragment.firstElementChild);
  } else {
    nav.innerHTML = `<div class="default-content-wrapper"><p><a href="/">AbbVie</a></p></div>
      <div class="default-content-wrapper"><ul>
        <li><a href="/who-we-are">Who We Are</a></li>
        <li><a href="/science">Science</a></li>
        <li><a href="/patients">Patients</a></li>
        <li><a href="/join-us">Join Us</a></li>
        <li><a href="/sustainability">Sustainability</a></li>
      </ul></div>
      <div class="default-content-wrapper"><p><a href="/search">Search</a></p></div>`;
  }

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    const brandLink = navBrand.querySelector('.button') || navBrand.querySelector('a');
    if (brandLink) {
      brandLink.className = '';
      const btnContainer = brandLink.closest('.button-container');
      if (btnContainer) btnContainer.className = '';
      // Ensure brand has logo image
      if (!brandLink.querySelector('img')) {
        brandLink.textContent = '';
        const logo = document.createElement('img');
        logo.src = '/icons/abbvie-logo.svg';
        logo.alt = 'AbbVie';
        brandLink.appendChild(logo);
      }
    }
  }

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      // Find link — may be direct child or wrapped in a <p> by AEM content pipeline
      let link = navSection.querySelector(':scope > a');
      if (!link) link = navSection.querySelector(':scope > p > a');
      const label = link ? link.textContent.trim() : '';

      // Check if this section has mega-menu content (from DOM or data module)
      const hasNestedUl = navSection.querySelector(':scope > ul');
      const hasFallbackData = NAV_MEGA_MENU[label];
      const hasDropdown = hasNestedUl || hasFallbackData;

      if (hasDropdown) {
        navSection.classList.add('nav-drop');

        // Unwrap the link from its <p> wrapper so it's a direct child of <li>
        if (link) {
          const linkParent = link.parentElement;
          if (linkParent && linkParent.tagName === 'P' && linkParent.parentElement === navSection) {
            navSection.insertBefore(link, linkParent);
            linkParent.remove();
          }
        }

        // Hide description <p> elements (those without links, after the nav link)
        navSection.querySelectorAll(':scope > p').forEach((p) => {
          if (!p.querySelector('a')) {
            p.hidden = true;
          }
        });
      }

      if (link) {
        link.addEventListener('click', (e) => {
          if (hasDropdown) e.preventDefault();
        });
      }

      navSection.addEventListener('click', () => {
        if (isDesktop.matches && hasDropdown) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          closeMegaMenu(nav);
          if (!expanded) {
            navSection.setAttribute('aria-expanded', 'true');
            buildMegaMenu(navSection, navWrapper);
          }
        }
      });
    });
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  navWrapper.append(nav);
  block.append(navWrapper);
}
