function isRdLeaderProfilePath() {
  const p = window.location.pathname.replace(/\.html$/i, '').replace(/\/$/, '');
  return /\/our-rd-leaders\/[^/]+$/.test(p);
}

function isRdLeadersListingPath() {
  const p = window.location.pathname.replace(/\.html$/i, '').replace(/\/$/, '');
  return p === '/science/our-people/our-rd-leaders';
}

function topLevelSectionsUnderMain(mainEl) {
  const candidates = [...mainEl.querySelectorAll('.section')];
  return candidates.filter((sec) => {
    let p = sec.parentElement;
    while (p && p !== mainEl) {
      if (p.classList?.contains('section')) return false;
      p = p.parentElement;
    }
    return p === mainEl;
  });
}

function titleCaseFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function insertBreadcrumb(main, attempt = 0) {
  const onListing = isRdLeadersListingPath();
  const onProfile = isRdLeaderProfilePath();
  if (!onListing && !onProfile) return;
  if (main.querySelector('.rd-leaders-breadcrumb')) return;

  const heroContent = main.querySelector('.hero-interior-content');
  const textHeroWrap = main.querySelector(
    '.section.navy-dark.rd-leaders-text-hero > .default-content-wrapper',
  );

  let mount = heroContent || textHeroWrap;
  if (!mount && onProfile && attempt < 25) {
    window.setTimeout(() => insertBreadcrumb(main, attempt + 1), 40);
    return;
  }

  if (onListing && !mount) {
    const first = main.querySelector('.section');
    mount = first?.querySelector(':scope > .default-content-wrapper')
      || first?.querySelector(':scope > div')
      || first;
  }

  if (!mount) return;

  const nav = document.createElement('nav');
  nav.className = 'rd-leaders-breadcrumb';
  nav.setAttribute('aria-label', 'Breadcrumb');

  const ol = document.createElement('ol');
  ol.className = 'rd-leaders-breadcrumb-list';

  const addItem = (href, label, isCurrent) => {
    const li = document.createElement('li');
    li.className = 'rd-leaders-breadcrumb-item';
    if (isCurrent) {
      li.classList.add('rd-leaders-breadcrumb-current');
      li.setAttribute('aria-current', 'page');
      li.textContent = label;
    } else {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      li.append(a);
    }
    ol.append(li);
  };

  addItem('/science', 'Science', false);
  addItem('/science/our-people', 'Our People', false);

  if (onProfile) {
    addItem('/science/our-people/our-rd-leaders', 'Our R&D Leaders', false);
    const h1 = main.querySelector(
      '.hero-interior-heading h1, .hero-interior .hero-interior-heading h1, .hero-interior-content h1',
    ) || main.querySelector('.section.navy-dark.rd-leaders-text-hero h1');
    const path = window.location.pathname.replace(/\.html$/i, '').replace(/\/$/, '');
    const slug = path.split('/').pop() || '';
    const name = (h1?.textContent?.trim()) || titleCaseFromSlug(slug);
    addItem(null, name, true);
  } else {
    addItem(null, 'Our R&D Leaders', true);
  }

  nav.append(ol);
  mount.insertBefore(nav, mount.firstChild);
}

export default function decorate(doc) {
  const main = doc.querySelector('main');
  if (!main) return;
  main.classList.add('rd-leaders-template');

  const roots = topLevelSectionsUnderMain(main);

  const heroSection = main.querySelector('.section.hero-interior-container');
  if (heroSection && !heroSection.classList.contains('navy-dark')) {
    heroSection.classList.add('navy-dark');
  }

  if (!heroSection && isRdLeaderProfilePath()) {
    const first = roots[0] || main.querySelector('.section');
    const hasPlainTitle = first?.querySelector(
      ':scope > .default-content-wrapper h1',
    );
    if (first && hasPlainTitle && !first.querySelector('.hero-interior')) {
      first.classList.add('navy-dark', 'rd-leaders-text-hero');
    }
  }

  roots.forEach((sec) => {
    if (
      sec.classList.contains('hero-interior-container')
      || sec.classList.contains('navy-dark')
      || sec.classList.contains('columns-bio-container')
    ) {
      sec.classList.add('rd-leaders-contained');
    }
  });

  const topSection = main.querySelector('.section.hero-interior-container')
    || main.querySelector('.section.navy-dark.rd-leaders-text-hero')
    || main.querySelector('.section.navy-dark');
  if (topSection?.classList.contains('rd-leaders-contained')) {
    topSection.classList.add('rd-leaders-contained-top');
  }

  const lastSection = roots.length ? roots[roots.length - 1] : main.querySelector('.section');
  if (lastSection) {
    lastSection.classList.add('rd-leaders-contained-bottom');
  }

  insertBreadcrumb(main);
}
