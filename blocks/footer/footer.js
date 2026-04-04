import { getMetadata, decorateIcons } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

function createScrollToTop() {
  const wrapper = document.createElement('div');
  wrapper.className = 'footer-scroll-top';
  const button = document.createElement('button');
  button.setAttribute('aria-label', 'Scroll to top of page');
  // Use EDS icon span - decorateIcons() will load SVG from /icons/
  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon icon-chevron-right';
  button.appendChild(iconSpan);
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  wrapper.appendChild(button);
  return wrapper;
}

function createSocialLinks() {
  const socialData = [
    { href: 'https://www.facebook.com/AbbVieGlobal', label: 'Facebook', icon: 'footer-facebook' },
    { href: 'https://twitter.com/abbvie', label: 'Twitter', icon: 'footer-twitter' },
    { href: 'https://www.instagram.com/abbvie/', label: 'Instagram', icon: 'footer-instagram' },
    { href: 'https://www.linkedin.com/company/abbvie', label: 'LinkedIn', icon: 'footer-linkedin' },
    { href: 'https://www.youtube.com/user/AbbVie', label: 'YouTube', icon: 'footer-youtube' },
    { href: 'https://www.tiktok.com/@abbvie', label: 'TikTok', icon: 'footer-tiktok' },
  ];

  const ul = document.createElement('ul');
  ul.className = 'footer-social';
  socialData.forEach(({ href, label, icon }) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.setAttribute('aria-label', `${label} - Opens in a new window`);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    // Use EDS icon span pattern - decorateIcons() will load SVG from /icons/
    const iconSpan = document.createElement('span');
    iconSpan.className = `icon icon-${icon}`;
    a.appendChild(iconSpan);
    li.appendChild(a);
    ul.appendChild(li);
  });
  return ul;
}

function decorateExternalLinks(wrapper) {
  if (!wrapper) return;
  wrapper.querySelectorAll('li a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('http')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      const iconSpan = document.createElement('span');
      iconSpan.className = 'icon icon-chevron-right';
      a.appendChild(iconSpan);
    }
  });
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  block.textContent = '';

  if (fragment) {
    // Extract all section wrappers from the fragment
    const sections = [];
    while (fragment.firstElementChild) {
      const section = fragment.firstElementChild;
      const wrapper = section.querySelector('.default-content-wrapper');
      sections.push(wrapper || section);
      if (section.parentElement) section.remove();
    }

    // sections[0]: Logo + Nav links + Social links
    // sections[1]: Popular pages (h2 + ul)
    // sections[2]: External links (h2 + ul)
    // sections[3]: Disclaimer text
    // sections[4]: Bottom legal links

    // 1. Scroll-to-top button
    block.appendChild(createScrollToTop());

    // 2. Main grid container
    const grid = document.createElement('div');
    grid.className = 'footer-grid';

    // --- Logo column ---
    const logoCol = document.createElement('div');
    logoCol.className = 'footer-col-logo';
    const firstSection = sections[0];
    if (firstSection) {
      const logoP = firstSection.querySelector('p');
      if (logoP) {
        const logoA = logoP.querySelector('a');
        if (logoA) {
          // Replace text "AbbVie" with the logo SVG
          logoA.innerHTML = '<img src="/icons/abbvie-logo.svg" alt="AbbVie logo" width="88" height="16">';
        }
        logoCol.appendChild(logoP);
      }
    }
    grid.appendChild(logoCol);

    // --- Nav + Social column ---
    const navCol = document.createElement('div');
    navCol.className = 'footer-col-nav';
    if (firstSection) {
      const navList = firstSection.querySelector('ul');
      if (navList) {
        navList.classList.add('footer-nav-links');
        navCol.appendChild(navList);
      }
    }
    // Social links with EDS icon spans (loaded from /icons/ folder)
    navCol.appendChild(createSocialLinks());
    grid.appendChild(navCol);

    // --- Popular pages column ---
    const popCol = document.createElement('div');
    popCol.className = 'footer-col-popular';
    if (sections[1]) {
      sections[1].classList.add('footer-section-popular');
      popCol.appendChild(sections[1]);
    }
    grid.appendChild(popCol);

    // --- External links + Disclaimer column ---
    const extCol = document.createElement('div');
    extCol.className = 'footer-col-external';
    if (sections[2]) {
      sections[2].classList.add('footer-section-external');
      decorateExternalLinks(sections[2]);
      extCol.appendChild(sections[2]);
    }
    if (sections[3]) {
      sections[3].classList.add('footer-disclaimer');
      extCol.appendChild(sections[3]);
    }
    grid.appendChild(extCol);

    block.appendChild(grid);

    // 3. Divider
    const divider = document.createElement('hr');
    divider.className = 'footer-divider';
    block.appendChild(divider);

    // 4. Bottom legal links
    if (sections[4]) {
      sections[4].classList.add('footer-legal');
      block.appendChild(sections[4]);
    }

    // Resolve all icon spans to SVGs from /icons/ folder
    decorateIcons(block);
  } else {
    // Fallback
    block.innerHTML = `<div class="footer-grid">
      <div class="footer-col-logo">
        <p><a href="/"><img src="/icons/abbvie-logo.svg" alt="AbbVie logo" width="88" height="16"></a></p>
      </div>
      <div class="footer-col-nav">
        <ul class="footer-nav-links">
          <li><a href="/who-we-are.html">Who We Are</a></li>
          <li><a href="/science.html">Science</a></li>
          <li><a href="/patients.html">Patients</a></li>
          <li><a href="/join-us.html">Join Us</a></li>
          <li><a href="/sustainability.html">Sustainability</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-legal">
      <p>Copyright &copy; 2026 AbbVie Inc. North Chicago, Illinois, U.S.A.</p>
    </div>`;
  }
}
