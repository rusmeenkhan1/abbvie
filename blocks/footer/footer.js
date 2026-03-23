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
  if (fragment) {
    // Unwrap section wrappers - append their default-content-wrapper children directly
    while (fragment.firstElementChild) {
      const section = fragment.firstElementChild;
      const wrapper = section.querySelector('.default-content-wrapper');
      if (wrapper) {
        block.append(wrapper);
      } else {
        block.append(section);
      }
      if (section.parentElement) section.remove();
    }
  } else {
    block.innerHTML = `<div>
        <p><a href="/">AbbVie</a></p>
        <ul>
          <li><a href="/who-we-are.html">Who We Are</a></li>
          <li><a href="/science.html">Science</a></li>
          <li><a href="/patients.html">Patients</a></li>
          <li><a href="/join-us.html">Join Us</a></li>
          <li><a href="/sustainability.html">Sustainability</a></li>
        </ul>
      </div>
      <div>
        <p>Copyright © 2026 AbbVie Inc. North Chicago, Illinois, U.S.A.</p>
      </div>`;
  }
}
