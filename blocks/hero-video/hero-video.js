export default function decorate(block) {
  // Convert image links to img elements
  block.querySelectorAll('a[href]').forEach((link) => {
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

  const firstDiv = block.querySelector(':scope > div:first-child');
  if (firstDiv && !firstDiv.querySelector('picture') && !firstDiv.querySelector('img')) {
    block.classList.add('no-image');
  }
}
