export default function decorate(block) {
  const slides = [...block.children];

  // Convert image links to actual img elements
  slides.forEach((slide, index) => {
    const imageDiv = slide.querySelector(':scope > div:first-child');
    if (imageDiv) {
      const link = imageDiv.querySelector('a[href]');
      if (link && !imageDiv.querySelector('picture, img')) {
        const src = link.href;
        const alt = link.textContent.trim() || link.title || '';
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.loading = index === 0 ? 'eager' : 'lazy';
        imageDiv.innerHTML = '';
        imageDiv.appendChild(img);
      }
    }
  });

  if (slides.length <= 1) return;

  // Add slide classes
  slides.forEach((slide, index) => {
    slide.classList.add('hero-homepage-slide');
    if (index === 0) {
      slide.classList.add('hero-homepage-slide-active');
    }
  });

  // Create navigation dots
  const nav = document.createElement('div');
  nav.classList.add('hero-homepage-nav');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Hero slide navigation');

  slides.forEach((slide, index) => {
    const dot = document.createElement('button');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
    dot.tabIndex = index === 0 ? 0 : -1;
    nav.appendChild(dot);
  });

  block.appendChild(nav);

  let currentIndex = 0;
  let autoPlayTimer;
  const dots = [...nav.querySelectorAll('button')];

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  }

  function goToSlide(index) {
    slides[currentIndex].classList.remove('hero-homepage-slide-active');
    dots[currentIndex].setAttribute('aria-selected', 'false');
    dots[currentIndex].tabIndex = -1;

    currentIndex = index;

    slides[currentIndex].classList.add('hero-homepage-slide-active');
    dots[currentIndex].setAttribute('aria-selected', 'true');
    dots[currentIndex].tabIndex = 0;
  }

  function advanceSlide() {
    goToSlide((currentIndex + 1) % slides.length);
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoPlayTimer = setInterval(advanceSlide, 6000);
  }

  // Dot click handlers
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      goToSlide(index);
      startAutoPlay();
    });
  });

  // Keyboard navigation
  nav.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (currentIndex + 1) % slides.length;
      goToSlide(next);
      dots[next].focus();
      startAutoPlay();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (currentIndex - 1 + slides.length) % slides.length;
      goToSlide(prev);
      dots[prev].focus();
      startAutoPlay();
    }
  });

  // Start auto-play
  startAutoPlay();
}
