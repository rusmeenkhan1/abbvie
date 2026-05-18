function resolveImageLink(container) {
  const link = container.querySelector('a[href*="scene7"], a[href*="/media_"]');
  if (link) {
    const img = document.createElement('img');
    img.src = link.href;
    img.alt = link.textContent || '';
    img.loading = 'lazy';
    return img;
  }
  const img = container.querySelector('img');
  if (img) return img.closest('picture') || img;
  return null;
}

export default function decorate(block) {
  const rows = [...block.children];
  const ul = document.createElement('ul');
  ul.className = 'cards-feature-list';

  rows.forEach((row) => {
    const cols = [...row.children];
    if (cols.length < 2) return;

    const li = document.createElement('li');
    li.className = 'cards-feature-card';

    // Image column
    const imgCol = cols[0];
    const imgEl = resolveImageLink(imgCol);
    const cardImage = document.createElement('div');
    cardImage.className = 'cards-feature-image';
    if (imgEl) {
      cardImage.append(imgEl);
    }

    // Text column
    const textCol = cols[1];
    const cardBody = document.createElement('div');
    cardBody.className = 'cards-feature-body';

    const paragraphs = [...textCol.querySelectorAll('p')];
    paragraphs.forEach((p) => {
      const link = p.querySelector('a');
      const strong = p.querySelector('strong');

      if (strong && !link) {
        const title = document.createElement('h3');
        title.className = 'cards-feature-title';
        title.textContent = strong.textContent;
        cardBody.append(title);
      } else if (link) {
        const cta = document.createElement('p');
        cta.className = 'cards-feature-cta';
        const a = document.createElement('a');
        a.href = link.href;
        a.textContent = link.textContent;
        cta.append(a);
        cardBody.append(cta);
      } else if (p.textContent.trim()) {
        const desc = document.createElement('p');
        desc.className = 'cards-feature-description';
        desc.textContent = p.textContent.trim();
        cardBody.append(desc);
      }
    });

    li.append(cardImage, cardBody);
    ul.append(li);
  });

  block.replaceChildren(ul);
}
