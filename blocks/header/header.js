import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

// Sub-navigation content matching the original AbbVie site
const NAV_SUBMENUS = {
  'Who We Are': [
    { text: 'Our Principles', href: '/who-we-are/our-principles' },
    { text: 'Operating with Integrity', href: '/who-we-are/operating-with-integrity' },
    { text: 'Key Facts', href: '/who-we-are/key-facts' },
    { text: 'Our Leaders', href: '/who-we-are/our-leaders' },
    { text: 'Policies & Disclosures', href: '/who-we-are/policies-and-disclosures' },
    { text: 'Our Stories', href: '/who-we-are/our-stories' },
  ],
  Science: [
    { text: 'Immunology', href: '/science/areas-of-focus/immunology' },
    { text: 'Oncology', href: '/science/areas-of-focus/oncology' },
    { text: 'Neuroscience', href: '/science/areas-of-focus/neuroscience' },
    { text: 'Eye Care', href: '/science/areas-of-focus/eye-care' },
    { text: 'Aesthetics', href: '/science/areas-of-focus/aesthetics' },
    { text: 'Pipeline', href: '/science/pipeline' },
    { text: 'Partner with Us', href: '/science/partner-with-us' },
    { text: 'Clinical Trials', href: '/science/clinical-trials' },
  ],
  Patients: [
    { text: 'Patient Support', href: '/patients/patient-support' },
    { text: 'Product Quality & Safety', href: '/patients/product-quality-and-safety' },
    { text: 'Products', href: '/patients/products' },
  ],
  'Join Us': [
    { text: 'Opportunities', href: '/join-us/opportunities' },
    { text: 'Life at AbbVie', href: '/join-us/life-at-abbvie' },
    { text: 'Why AbbVie', href: '/join-us/why-abbvie' },
    { text: 'Students & New Graduates', href: '/join-us/students-and-new-graduates' },
  ],
  Sustainability: [
    { text: 'AbbVie Foundation', href: '/sustainability/abbvie-foundation' },
    { text: 'Environmental, Social & Governance', href: '/sustainability/environmental-social-and-governance' },
    { text: 'Disaster Relief', href: '/sustainability/disaster-relief' },
  ],
};

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
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
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
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
        <li><a href="/who-we-are.html">Who We Are</a></li>
        <li><a href="/science.html">Science</a></li>
        <li><a href="/patients.html">Patients</a></li>
        <li><a href="/join-us.html">Join Us</a></li>
        <li><a href="/sustainability.html">Sustainability</a></li>
      </ul></div>
      <div class="default-content-wrapper"><p><a href="/search.html">Search</a></p></div>`;
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

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      navSection.classList.add('nav-drop');

      const link = navSection.querySelector(':scope > a');
      if (link && !navSection.querySelector('ul')) {
        const label = link.textContent.trim();
        const submenuItems = NAV_SUBMENUS[label] || [];
        const dropdown = document.createElement('ul');

        submenuItems.forEach((item) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = item.href;
          a.textContent = item.text;
          li.append(a);
          dropdown.append(li);
        });

        if (dropdown.children.length === 0) {
          const li = document.createElement('li');
          const goLink = document.createElement('a');
          goLink.href = link.href;
          goLink.textContent = `Go to ${label}`;
          li.append(goLink);
          dropdown.append(li);
        }

        navSection.append(dropdown);
      }

      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
        });
      }

      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
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

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
