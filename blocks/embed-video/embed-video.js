export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  // Row 0: col 0 = thumbnail, col 1 = video URL
  const firstRow = rows[0];
  const cols = [...firstRow.children];
  const imgCol = cols[0];
  const urlCol = cols[1] || cols[0];

  const img = imgCol?.querySelector('img');
  const link = urlCol?.querySelector('a');
  const videoUrl = link?.href || link?.textContent?.trim() || '';

  // Extract title from URL column (H2 or extra paragraphs)
  let titleText = '';
  let watchText = '';
  const h2InCol = urlCol?.querySelector('h2');
  if (h2InCol) titleText = h2InCol.textContent.trim();

  const paragraphs = urlCol?.querySelectorAll('p') || [];
  paragraphs.forEach((p) => {
    const text = p.textContent.trim();
    if (p.querySelector('a')) return;
    if (text.toLowerCase().startsWith('watch')) {
      watchText = text;
    } else if (text && !titleText) {
      titleText = text;
    }
  });

  // Fallback: check additional rows
  if (!titleText && rows.length > 1) {
    const secondRow = rows[1];
    const divs = [...secondRow.children];
    if (divs.length >= 1) titleText = divs[0]?.textContent?.trim() || '';
    if (divs.length >= 2 && !watchText) watchText = divs[1]?.textContent?.trim() || '';
  }

  // Fallback: look for preceding H2 sibling in section
  if (!titleText) {
    const section = block.closest('.section');
    if (section) {
      const h2 = section.querySelector('.default-content-wrapper h2');
      if (h2) titleText = h2.textContent.trim();
    }
  }

  // Fallback: use link text if it starts with "Watch"
  if (!watchText && link) {
    const linkText = link.textContent.trim();
    if (linkText.toLowerCase().startsWith('watch')) {
      watchText = linkText;
    }
  }

  // Build video player structure
  const wrapper = document.createElement('div');
  wrapper.className = 'embed-video-player';

  // Thumbnail
  const thumbDiv = document.createElement('div');
  thumbDiv.className = 'embed-video-thumbnail';
  if (img) {
    const picture = img.closest('picture') || img;
    thumbDiv.append(picture);
  }
  wrapper.append(thumbDiv);

  // Overlay with title and play button
  const overlay = document.createElement('div');
  overlay.className = 'embed-video-overlay';

  if (titleText) {
    const title = document.createElement('h2');
    title.textContent = titleText;
    overlay.append(title);
  }

  // Play button
  const playBtn = document.createElement('button');
  playBtn.className = 'embed-video-play';
  playBtn.setAttribute('aria-label', 'Play video');

  const playIcon = document.createElement('span');
  playIcon.className = 'embed-video-play-icon';
  playIcon.innerHTML = '&#9654;';
  playBtn.append(playIcon);

  const watchLabel = document.createElement('span');
  watchLabel.className = 'embed-video-watch-label';
  watchLabel.textContent = watchText || 'Watch';
  playBtn.append(watchLabel);

  overlay.append(playBtn);
  wrapper.append(overlay);

  // Click handler: replace thumbnail with iframe
  wrapper.addEventListener('click', () => {
    let embedUrl = videoUrl;
    const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (ytMatch) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    }
    const bcMatch = videoUrl.match(/brightcove\.net\/(\d+)\/.*videoId=(\d+)/);
    if (bcMatch) {
      embedUrl = `https://players.brightcove.net/${bcMatch[1]}/default_default/index.html?videoId=${bcMatch[2]}`;
    }

    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';

    wrapper.innerHTML = '';
    wrapper.style.position = 'relative';
    wrapper.style.paddingBottom = '56.25%';
    wrapper.append(iframe);
  });

  block.replaceChildren(wrapper);
}
