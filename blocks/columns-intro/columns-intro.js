export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-intro-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-intro-img-col');
        }
      } else if (col.children.length === 0) {
        // Empty column — inject placeholder image if available
        const img = document.createElement('img');
        img.src = 'https://abbvie.scene7.com/is/image/abbviecorp/the-persistence-lab-promo';
        img.alt = 'The Persistence Lab';
        img.loading = 'lazy';
        col.appendChild(img);
        col.classList.add('columns-intro-img-col');
      }
    });
  });
}
