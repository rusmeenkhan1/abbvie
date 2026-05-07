export default function decorate(block) {
  const slides = [...block.children];

  slides.forEach((slide) => {
    const imageDiv = slide.querySelector(':scope > div:first-child');
    if (imageDiv) {
      const link = imageDiv.querySelector('a[href]');
      if (link && !imageDiv.querySelector('picture, img')) {
        const src = link.href;
        const alt = link.textContent.trim() || link.title || '';
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.loading = slides.indexOf(slide) === 0 ? 'eager' : 'lazy';
        imageDiv.innerHTML = '';
        imageDiv.appendChild(img);
      }
    }
  });

  if (slides.length <= 1) return;

  slides.forEach((slide, index) => {
    slide.classList.add('hero-homepage-slide');
    if (index === 0) {
      slide.classList.add('hero-homepage-slide-active');
    }
  });

  let currentIndex = 0;

  function advanceSlide() {
    slides[currentIndex].classList.remove('hero-homepage-slide-active');
    currentIndex = (currentIndex + 1) % slides.length;
    slides[currentIndex].classList.add('hero-homepage-slide-active');
  }

  setInterval(advanceSlide, 6000);
}
