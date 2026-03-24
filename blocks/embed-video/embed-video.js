/*
 * Embed Video Block
 * Show videos directly on your page
 */

const loadScript = (url, callback, type) => {
  const head = document.querySelector('head');
  const script = document.createElement('script');
  script.src = url;
  if (type) {
    script.setAttribute('type', type);
  }
  script.onload = callback;
  head.append(script);
  return script;
};

const getDefaultEmbed = (url) => `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
    <iframe src="${url.href}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" allowfullscreen=""
      scrolling="no" allow="encrypted-media" title="Content from ${url.hostname}" loading="lazy">
    </iframe>
  </div>`;

const embedYoutube = (url, autoplay) => {
  const usp = new URLSearchParams(url.search);
  const suffix = autoplay ? '&muted=1&autoplay=1' : '';
  let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
  const embed = url.pathname;
  if (url.origin.includes('youtu.be')) {
    [, vid] = url.pathname.split('/');
  }
  const embedHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; picture-in-picture" allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
    </div>`;
  return embedHTML;
};

const embedVimeo = (url, autoplay) => {
  const [, video] = url.pathname.split('/');
  const suffix = autoplay ? '?muted=1&autoplay=1' : '';
  const embedHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://player.vimeo.com/video/${video}${suffix}"
      style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;"
      frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen
      title="Content from Vimeo" loading="lazy"></iframe>
    </div>`;
  return embedHTML;
};

const embedTwitter = (url) => {
  if (!url.href.startsWith('https://twitter.com')) {
    url.href = url.href.replace('https://x.com', 'https://twitter.com');
  }
  const embedHTML = `<blockquote class="twitter-tweet"><a href="${url.href}"></a></blockquote>`;
  loadScript('https://platform.twitter.com/widgets.js');
  return embedHTML;
};

const loadEmbed = (block, link, autoplay) => {
  if (block.classList.contains('embed-video-is-loaded')) {
    return;
  }

  const EMBEDS_CONFIG = [
    {
      match: ['youtube', 'youtu.be'],
      embed: embedYoutube,
    },
    {
      match: ['vimeo'],
      embed: embedVimeo,
    },
    {
      match: ['twitter', 'x.com'],
      embed: embedTwitter,
    },
  ];
  const config = EMBEDS_CONFIG.find((e) => e.match.some((match) => link.includes(match)));
  const url = new URL(link);
  if (config) {
    block.innerHTML = config.embed(url, autoplay);
    block.classList = `block embed-video embed-video-${config.match[0]}`;
  } else {
    block.innerHTML = getDefaultEmbed(url);
    block.classList = 'block embed-video';
  }
  block.classList.add('embed-video-is-loaded');
};

export default function decorate(block) {
  const placeholder = block.querySelector('picture') || block.querySelector('img');
  const link = block.querySelector('a').href;

  // Extract overlay content from additional rows (row 2: title/desc, row 3: CTA)
  const rows = [...block.children];
  let overlayTitle = '';
  let overlayDesc = '';
  let overlayCta = '';
  if (rows.length > 1) {
    const titleCell = rows[1]?.querySelector('div:first-child');
    const descCell = rows[1]?.querySelector('div:last-child');
    overlayTitle = titleCell?.textContent?.trim() || '';
    overlayDesc = descCell?.textContent?.trim() || '';
  }
  if (rows.length > 2) {
    const ctaCell = rows[2]?.querySelector('div:first-child');
    overlayCta = ctaCell?.textContent?.trim() || '';
  }

  block.textContent = '';

  if (placeholder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'embed-video-placeholder';

    // Build overlay HTML
    let overlayHTML = '';
    if (overlayTitle || overlayCta) {
      overlayHTML += '<div class="embed-video-overlay">';
      if (overlayTitle) overlayHTML += `<h2>${overlayTitle}</h2>`;
      if (overlayDesc) overlayHTML += `<p>${overlayDesc}</p>`;
      if (overlayCta) overlayHTML += `<button type="button" class="embed-video-cta"><span class="embed-video-cta-icon"></span><span>${overlayCta}</span></button>`;
      overlayHTML += '</div>';
    } else {
      overlayHTML = '<div class="embed-video-placeholder-play"><button type="button" title="Play"></button></div>';
    }

    wrapper.innerHTML = overlayHTML;
    wrapper.prepend(placeholder);
    wrapper.addEventListener('click', () => {
      loadEmbed(block, link, true);
    });
    block.append(wrapper);
  } else {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        loadEmbed(block, link);
      }
    });
    observer.observe(block);
  }
}
