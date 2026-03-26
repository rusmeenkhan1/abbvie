import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const SOCIAL_LINKS = [
  { name: 'facebook', url: 'https://www.facebook.com/AbbVieGlobal', label: 'Facebook' },
  { name: 'x', url: 'https://twitter.com/abbvie', label: 'X' },
  { name: 'instagram', url: 'https://www.instagram.com/abbvie/', label: 'Instagram' },
  { name: 'linkedin', url: 'https://www.linkedin.com/company/abbvie', label: 'LinkedIn' },
  { name: 'youtube', url: 'https://www.youtube.com/user/AbbVie', label: 'YouTube' },
  { name: 'tiktok', url: 'https://www.tiktok.com/@abbvie', label: 'TikTok' },
];

function buildSocialLinks() {
  const wrapper = document.createElement('div');
  wrapper.className = 'footer-social';
  const ul = document.createElement('ul');
  SOCIAL_LINKS.forEach(({ name, url, label }) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', `${label} - Opens in a new window`);
    const img = document.createElement('img');
    img.src = `/icons/social-${name}.svg`;
    img.alt = label;
    img.width = 24;
    img.height = 24;
    img.loading = 'lazy';
    a.append(img);
    li.append(a);
    ul.append(li);
  });
  wrapper.append(ul);
  return wrapper;
}

function buildBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'footer-back-to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.type = 'button';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 4h16M12 20V8M5 14l7-7 7 7');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  btn.append(svg);
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  return btn;
}

function decorateExternalLinks(container) {
  // Only decorate links within the external links section (not social icons or legal bar)
  const externalSection = container.querySelector('.footer-external');
  if (!externalSection) return;
  externalSection.querySelectorAll(':scope > ul > li > a[href]').forEach((a) => {
    try {
      const url = new URL(a.href, window.location.origin);
      if (url.hostname !== window.location.hostname) {
        a.classList.add('footer-external-link');
        if (!a.target) a.target = '_blank';
        if (!a.rel) a.rel = 'noopener noreferrer';
      }
    } catch {
      // invalid URL
    }
  });
}

function stripButtonDecoration(container) {
  container.querySelectorAll('a.button').forEach((a) => {
    a.classList.remove('button', 'primary', 'secondary', 'accent');
  });
  container.querySelectorAll('p.button-wrapper').forEach((p) => {
    p.classList.remove('button-wrapper');
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
  if (!fragment) return;

  // Extract sections from fragment
  const sections = [];
  while (fragment.firstElementChild) {
    const section = fragment.firstElementChild;
    const wrapper = section.querySelector('.default-content-wrapper') || section;
    sections.push(wrapper);
    section.remove();
  }

  // sections[0]: Logo + nav links
  // sections[1]: Popular pages (h2 + ul)
  // sections[2]: External links (h2 + ul)
  // sections[3]: Disclaimer + copyright
  // sections[4]: Legal links bar

  // Back-to-top button
  block.append(buildBackToTop());

  // Main footer grid
  const grid = document.createElement('div');
  grid.className = 'footer-grid';

  // 1. Logo cell
  const logoCell = document.createElement('div');
  logoCell.className = 'footer-logo';
  const logoPara = sections[0]?.querySelector('p');
  if (logoPara) {
    // Replace text "AbbVie" with logo image if it's just a link
    const logoLink = logoPara.querySelector('a');
    if (logoLink) {
      const logoImg = document.createElement('img');
      logoImg.src = '/icons/abbvie-logo.svg';
      logoImg.alt = 'AbbVie';
      logoImg.width = 88;
      logoImg.height = 16;
      logoImg.loading = 'lazy';
      logoLink.textContent = '';
      logoLink.append(logoImg);
      logoLink.setAttribute('aria-label', 'AbbVie Home');
    }
    logoCell.append(logoPara);
  }
  grid.append(logoCell);

  // 2. Nav + Social cell
  const navCell = document.createElement('div');
  navCell.className = 'footer-nav';
  const navList = sections[0]?.querySelector('ul');
  if (navList) navCell.append(navList);
  navCell.append(buildSocialLinks());
  grid.append(navCell);

  // 3. Popular pages cell
  const popularCell = document.createElement('div');
  popularCell.className = 'footer-popular';
  if (sections[1]) {
    while (sections[1].firstChild) popularCell.append(sections[1].firstChild);
  }
  grid.append(popularCell);

  // 4. External links + disclaimer cell
  const externalCell = document.createElement('div');
  externalCell.className = 'footer-external';
  if (sections[2]) {
    while (sections[2].firstChild) externalCell.append(sections[2].firstChild);
  }

  // Separator between external links and disclaimer
  const sep = document.createElement('div');
  sep.className = 'footer-ext-separator';
  externalCell.append(sep);

  // Disclaimer text
  if (sections[3]) {
    const disclaimerWrap = document.createElement('div');
    disclaimerWrap.className = 'footer-disclaimer';
    while (sections[3].firstChild) disclaimerWrap.append(sections[3].firstChild);
    externalCell.append(disclaimerWrap);
  }
  grid.append(externalCell);

  block.append(grid);

  // Divider line
  const hr = document.createElement('hr');
  hr.className = 'footer-divider';
  block.append(hr);

  // Legal links bar
  const legalBar = document.createElement('div');
  legalBar.className = 'footer-legal';
  if (sections[4]) {
    while (sections[4].firstChild) legalBar.append(sections[4].firstChild);
  }

  // Add extra legal links not in content (Cookies Settings + Your Privacy Choices)
  const legalUl = legalBar.querySelector('ul');
  if (legalUl) {
    // Cookies Settings
    const cookiesLi = document.createElement('li');
    const cookiesA = document.createElement('a');
    cookiesA.href = '#';
    cookiesA.className = 'footer-cookies-settings';
    cookiesA.textContent = 'Cookies Settings';
    cookiesA.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.OneTrust) window.OneTrust.ToggleInfoDisplay();
    });
    cookiesLi.append(cookiesA);
    legalUl.append(cookiesLi);

    // Your Privacy Choices
    const privacyLi = document.createElement('li');
    privacyLi.className = 'footer-privacy-choices';
    const privacyA = document.createElement('a');
    privacyA.href = 'https://abbviemetadata.my.site.com/AbbvieDSRM';
    privacyA.target = '_blank';
    privacyA.rel = 'noopener noreferrer';
    privacyA.textContent = 'Your Privacy Choices';
    privacyLi.append(privacyA);
    // Privacy icon
    const privacyIcon = document.createElement('img');
    privacyIcon.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'30\' height=\'14\' viewBox=\'0 0 30 14\'%3E%3Crect x=\'0\' y=\'0\' width=\'30\' height=\'14\' rx=\'7\' fill=\'%23007bff\'/%3E%3Ccircle cx=\'9\' cy=\'7\' r=\'5\' fill=\'%23fff\'/%3E%3Cpath d=\'M15 1h8a6 6 0 0 1 0 12h-8z\' fill=\'%2300a4e4\'/%3E%3C/svg%3E';
    privacyIcon.alt = 'Your Privacy Choices';
    privacyIcon.className = 'footer-privacy-icon';
    privacyLi.append(privacyIcon);
    legalUl.append(privacyLi);
  }

  block.append(legalBar);

  // Strip button decoration that EDS auto-applies
  stripButtonDecoration(block);

  // Add external link indicators
  decorateExternalLinks(block);
}
