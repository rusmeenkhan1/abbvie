export default async function decorate(block) {
  // Load video config
  let videoUrl = '';
  const heading = block.querySelector('h2, h1');
  if (heading?.id) {
    try {
      const resp = await fetch('/blocks/hero-video/video-config.json');
      if (resp.ok) {
        const config = await resp.json();
        videoUrl = config.videos?.[heading.id] || '';
      }
    } catch (e) { /* no config available */ }
  }

  // Convert image links to img elements
  block.querySelectorAll('a[href]').forEach((link) => {
    const href = link.href || '';
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(href) || href.includes('scene7');
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

  // Convert "Watch" text into a play button
  block.querySelectorAll('p').forEach((p) => {
    if (p.textContent.trim().toLowerCase().startsWith('watch') && !p.querySelector('a')) {
      const btn = document.createElement('button');
      btn.className = 'hero-video-play-btn';
      btn.textContent = p.textContent.trim();
      p.replaceWith(btn);
    }
  });

  // Attach click handler via event delegation
  if (videoUrl) {
    block.addEventListener('click', (e) => {
      if (!e.target.closest('.hero-video-play-btn')) return;
      if (block.querySelector('iframe')) return;
      const embedSrc = `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}autoplay=true`;
      const iframe = document.createElement('iframe');
      iframe.src = embedSrc;
      iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:10;border:0;border-radius:inherit;';
      block.appendChild(iframe);
    });
  }
}
