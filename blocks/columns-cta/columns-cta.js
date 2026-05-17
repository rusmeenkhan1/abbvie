const CARD_IMAGES = [
  { src: 'https://abbvie.scene7.com/is/image/abbviecorp/man-looking-at-testtube-feature-tall-2?fmt=webp', alt: 'man looking at test tube' },
  { src: 'https://abbvie.scene7.com/is/image/abbviecorp/woman-scientist-examining-hero?fmt=webp', alt: 'young woman smiling' },
  { src: 'https://abbvie.scene7.com/is/image/abbviecorp/woman-speaking-to-man?fmt=webp', alt: 'woman in conference room' },
];

export default function decorate(block) {
  const columns = block.querySelectorAll(':scope > div > div');
  columns.forEach((col, i) => {
    col.classList.add('columns-cta-column');

    if (CARD_IMAGES[i]) {
      const wrapper = document.createElement('div');
      wrapper.className = 'columns-cta-image';
      const img = document.createElement('img');
      img.src = CARD_IMAGES[i].src;
      img.alt = CARD_IMAGES[i].alt;
      img.loading = 'lazy';
      wrapper.appendChild(img);
      col.prepend(wrapper);
    }
  });
}
