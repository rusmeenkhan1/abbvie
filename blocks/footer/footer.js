import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/* Social media SVG icons – navy blue (#071D49) matching original AbbVie footer */
const SOCIAL_ICONS = {
  facebook: '<svg width="14" height="24" viewBox="0 0 320 512" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H296V6.26S260.43 0 226.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h82.39v224h101.17V288z" fill="#071D49"/></svg>',
  twitter: '<svg width="24" height="22" viewBox="0 0 512 462" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M389.2 48h70.6L305.6 224.2 487 462H348.4L227.4 302.4 89 462H18.4l166-189.8L0 48h143l110 145.2L389.2 48zM362.4 416h39.2L150.8 88.8h-42L362.4 416z" fill="#071D49"/></svg>',
  instagram: '<svg width="24" height="24" viewBox="0 0 448 512" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9S160.5 370.9 224.1 370.9 339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1S3.8 127.9 2.1 163.8c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" fill="#071D49"/></svg>',
  linkedin: '<svg width="24" height="24" viewBox="0 0 448 512" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z" fill="#071D49"/></svg>',
  youtube: '<svg width="24" height="17" viewBox="0 0 576 412" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V174.6l142.739 81.205-142.739 81.786z" fill="#071D49"/></svg>',
  tiktok: '<svg width="20" height="24" viewBox="0 0 448 512" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121.18 121.18 0 00122.77 109.44v100.47z" fill="#071D49"/></svg>',
};

const EXTERNAL_LINK_SVG = '<svg class="external-link-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 2H2.5C1.67 2 1 2.67 1 3.5v10c0 .83.67 1.5 1.5 1.5h10c.83 0 1.5-.67 1.5-1.5v-2M8 1h7v7M15 1L6.5 9.5" stroke="#071D49" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const SCROLL_UP_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20V4M12 4L5 11M12 4l7 7" stroke="#071D49" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function createScrollToTop() {
  const wrapper = document.createElement('div');
  wrapper.className = 'footer-scroll-top';
  const button = document.createElement('button');
  button.setAttribute('aria-label', 'Scroll to top of page');
  button.innerHTML = SCROLL_UP_SVG;
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  wrapper.appendChild(button);
  return wrapper;
}

function createSocialLinks() {
  const socialData = [
    { href: 'https://www.facebook.com/AbbVieGlobal', label: 'Facebook', key: 'facebook' },
    { href: 'https://twitter.com/abbvie', label: 'Twitter', key: 'twitter' },
    { href: 'https://www.instagram.com/abbvie/', label: 'Instagram', key: 'instagram' },
    { href: 'https://www.linkedin.com/company/abbvie', label: 'LinkedIn', key: 'linkedin' },
    { href: 'https://www.youtube.com/user/AbbVie', label: 'YouTube', key: 'youtube' },
    { href: 'https://www.tiktok.com/@abbvie', label: 'TikTok', key: 'tiktok' },
  ];

  const ul = document.createElement('ul');
  ul.className = 'footer-social';
  socialData.forEach(({ href, label, key }) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.setAttribute('aria-label', `${label} - Opens in a new window`);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.innerHTML = SOCIAL_ICONS[key];
    li.appendChild(a);
    ul.appendChild(li);
  });
  return ul;
}

function decorateExternalLinks(wrapper) {
  if (!wrapper) return;
  wrapper.querySelectorAll('li a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    // Mark all external links in the External Links section
    if (href.startsWith('http')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      const iconSpan = document.createElement('span');
      iconSpan.className = 'icon-external';
      iconSpan.innerHTML = EXTERNAL_LINK_SVG;
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
    // Social links are generated in JS (EDS fragments only support one <ul> per section)
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
