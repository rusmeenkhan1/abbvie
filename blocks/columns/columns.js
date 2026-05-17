function convertLinksToImages(container) {
  container.querySelectorAll('a[href]').forEach((link) => {
    const href = link.href || '';
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(href)
      || href.includes('scene7');
    if (isImage && !link.closest('picture')) {
      const parent = link.closest('p') || link.parentElement;
      const isSoleChild = parent && parent.children.length === 1
        && parent.textContent.trim() === link.textContent.trim();
      if (isSoleChild) {
        const img = document.createElement('img');
        img.src = href;
        img.alt = link.textContent.trim() || '';
        img.loading = 'lazy';
        parent.replaceWith(img);
      }
    }
  });
}

export default function decorate(block) {
  convertLinksToImages(block);

  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture') || col.querySelector('img');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });
}
