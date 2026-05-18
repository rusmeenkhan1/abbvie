export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-media-${cols.length}-cols`);

  // Convert image links (Scene7 URLs) to actual img elements
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const links = col.querySelectorAll('a[href*="scene7.com/is/image"]');
      links.forEach((link) => {
        const img = document.createElement('img');
        img.src = link.href;
        img.alt = link.title || link.textContent || '';
        img.loading = 'lazy';
        const p = link.closest('p');
        if (p) {
          p.replaceWith(img);
        } else {
          link.replaceWith(img);
        }
      });
    });
  });

  // Detect variant: if block contains an h2 and img (partnership tile pattern), use light variant
  const hasH2 = block.querySelector('h2');
  const hasImg = block.querySelector('img');
  if (hasH2 && hasImg) {
    block.classList.add('columns-media-light');
  }

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      const img = col.querySelector('img');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-media-img-col');
        }
      } else if (img && col.children.length === 1) {
        col.classList.add('columns-media-img-col');
      }
    });
  });
}
