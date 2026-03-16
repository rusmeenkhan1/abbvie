import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  if (fragment) {
    while (fragment.firstElementChild) footer.append(fragment.firstElementChild);
  } else {
    footer.innerHTML = `<div class="default-content-wrapper">
        <p><a href="/">AbbVie</a></p>
        <ul>
          <li><a href="/who-we-are.html">Who We Are</a></li>
          <li><a href="/science.html">Science</a></li>
          <li><a href="/patients.html">Patients</a></li>
          <li><a href="/join-us.html">Join Us</a></li>
          <li><a href="/sustainability.html">Sustainability</a></li>
        </ul>
      </div>
      <div class="default-content-wrapper">
        <p>Copyright © 2026 AbbVie Inc. North Chicago, Illinois, U.S.A.</p>
      </div>`;
  }

  block.append(footer);
}
