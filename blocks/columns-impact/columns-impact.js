export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-impact-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const img = col.querySelector('picture img') || col.querySelector('img');
      const link = col.querySelector('a');

      if (img && link) {
        // Video column: extract overlay content from <p><strong>...</strong></p> patterns
        const strongPs = [...col.querySelectorAll('p strong')];
        let title = '';
        let cta = '';
        const titleEl = strongPs[0]?.closest('p');
        const ctaEl = strongPs[1]?.closest('p');
        if (titleEl) title = titleEl.textContent.trim();
        if (ctaEl) cta = ctaEl.textContent.trim();

        // Description is the plain <p> between title and CTA
        const allPs = [...col.querySelectorAll('p')];
        const descEl = allPs.find((p) => p !== titleEl && p !== ctaEl && !p.querySelector('strong'));
        const desc = descEl ? descEl.textContent.trim() : '';

        // Build video placeholder with overlay
        const videoUrl = link.href;
        col.textContent = '';
        col.classList.add('columns-impact-video-col');

        const wrapper = document.createElement('div');
        wrapper.className = 'columns-impact-video';

        let overlayHTML = '<div class="columns-impact-video-overlay">';
        if (title) overlayHTML += `<h2>${title}</h2>`;
        if (desc) overlayHTML += `<p>${desc}</p>`;
        if (cta) overlayHTML += `<button type="button" class="columns-impact-video-cta"><span class="columns-impact-video-cta-icon"></span><span>${cta}</span></button>`;
        overlayHTML += '</div>';

        wrapper.innerHTML = overlayHTML;
        wrapper.prepend(img);
        wrapper.addEventListener('click', () => {
          const url = new URL(videoUrl);
          col.innerHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
            <iframe src="${url.href}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;"
            allowfullscreen="" scrolling="no" allow="encrypted-media; autoplay" title="Content from ${url.hostname}" loading="lazy"></iframe>
          </div>`;
        });

        col.append(wrapper);
      } else if (img && !link) {
        // Plain image column
        const picWrapper = img.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-impact-img-col');
        }
      }
    });
  });
}
