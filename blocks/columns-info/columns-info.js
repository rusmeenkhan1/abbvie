const COLUMN_IMAGES = [
  { src: 'https://abbvie.scene7.com/is/image/abbviecorp/man-looking-at-testtube-feature-tall-2', alt: 'Scientist looking at test tube' },
  { src: 'https://abbvie.scene7.com/is/image/abbviecorp/three-women-in-meeting', alt: 'Women in meeting' },
  { src: 'https://abbvie.scene7.com/is/image/abbviecorp/woman-speaking-to-man', alt: 'Woman in conference room' },
];

export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-info-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col, i) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-info-img-col');
        }
      } else if (!col.querySelector('img') && COLUMN_IMAGES[i]) {
        // Inject missing column image
        const imgWrapper = document.createElement('div');
        imgWrapper.classList.add('columns-info-img-col');
        const img = document.createElement('img');
        img.src = COLUMN_IMAGES[i].src;
        img.alt = COLUMN_IMAGES[i].alt;
        img.loading = 'lazy';
        imgWrapper.appendChild(img);
        col.prepend(imgWrapper);
      }
    });
  });
}
