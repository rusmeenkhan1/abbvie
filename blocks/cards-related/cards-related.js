function buildCardFromRow(row) {
  const cols = [...row.children];
  if (cols.length < 2) return null;

  const li = document.createElement('li');
  li.className = 'cards-related-card';

  // Image column
  const imgCol = cols[0];
  const img = imgCol.querySelector('img');
  const cardImageDiv = document.createElement('div');
  cardImageDiv.className = 'cards-related-image';
  if (img) {
    const picture = img.closest('picture') || img;
    cardImageDiv.append(picture);
  }

  // Text column
  const textCol = cols[1];
  const cardBodyDiv = document.createElement('div');
  cardBodyDiv.className = 'cards-related-body';

  const paragraphs = [...textCol.querySelectorAll('p')];
  paragraphs.forEach((p) => {
    const link = p.querySelector('a');
    const strong = p.querySelector('strong');

    if (link) {
      const cta = document.createElement('p');
      cta.className = 'cards-related-cta';
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.textContent;
      cta.append(a);
      cardBodyDiv.append(cta);
    } else if (strong) {
      const title = document.createElement('h4');
      title.className = 'cards-related-title';
      title.textContent = strong.textContent;
      cardBodyDiv.append(title);
    } else if (p.textContent.trim()) {
      const text = p.textContent.trim();
      if (text.length < 30 && !text.includes('.')) {
        const cat = document.createElement('p');
        cat.className = 'cards-related-category';
        cat.textContent = text;
        cardBodyDiv.append(cat);
      } else {
        const desc = document.createElement('p');
        desc.className = 'cards-related-description';
        desc.textContent = text;
        cardBodyDiv.append(desc);
      }
    }
  });

  li.append(cardImageDiv, cardBodyDiv);

  const ctaLink = cardBodyDiv.querySelector('.cards-related-cta a');
  if (ctaLink) {
    const wrapper = document.createElement('a');
    wrapper.href = ctaLink.href;
    wrapper.className = 'cards-related-link';
    wrapper.append(cardImageDiv, cardBodyDiv);
    li.replaceChildren(wrapper);
  }

  return li;
}

function buildCardFromData(item) {
  const li = document.createElement('li');
  li.className = 'cards-related-card';

  const wrapper = document.createElement('a');
  wrapper.href = `${item.path}.html`;
  wrapper.className = 'cards-related-link';

  const cardImageDiv = document.createElement('div');
  cardImageDiv.className = 'cards-related-image';
  if (item.image) {
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.title;
    img.loading = 'lazy';
    cardImageDiv.append(img);
  }

  const cardBodyDiv = document.createElement('div');
  cardBodyDiv.className = 'cards-related-body';

  if (item.publishedDate) {
    const date = document.createElement('p');
    date.className = 'cards-related-date';
    date.textContent = item.publishedDate;
    cardBodyDiv.append(date);
  }

  if (item.category) {
    const cat = document.createElement('p');
    cat.className = 'cards-related-category';
    cat.textContent = item.category;
    cardBodyDiv.append(cat);
  }

  const title = document.createElement('h4');
  title.className = 'cards-related-title';
  title.textContent = item.title;
  cardBodyDiv.append(title);

  if (item.description) {
    const desc = document.createElement('p');
    desc.className = 'cards-related-description';
    desc.textContent = item.description;
    cardBodyDiv.append(desc);
  }

  const cta = document.createElement('p');
  cta.className = 'cards-related-cta';
  const ctaLink = document.createElement('a');
  ctaLink.href = `${item.path}.html`;
  ctaLink.textContent = 'Read Article';
  cta.append(ctaLink);
  cardBodyDiv.append(cta);

  wrapper.append(cardImageDiv, cardBodyDiv);
  li.append(wrapper);
  return li;
}

async function fetchRelatedByPath(relatedPath) {
  const prefix = window.location.pathname.startsWith('/content/') ? '/content' : '';
  const indexUrl = `${prefix}/who-we-are/our-stories/query-index.json`;

  try {
    const resp = await fetch(indexUrl);
    if (!resp.ok) return null;
    const json = await resp.json();

    // Find the specific related article by path
    const normalizedPath = relatedPath.replace(/\.html$/, '');
    return json.data.find((item) => item.path === normalizedPath) || null;
  } catch {
    return null;
  }
}

export default async function decorate(block) {
  const rows = [...block.children];
  const ul = document.createElement('ul');
  ul.className = 'cards-related-list';

  // Build cards from authored content
  rows.forEach((row) => {
    const card = buildCardFromRow(row);
    if (card) ul.append(card);
  });

  block.replaceChildren(ul);

  // Check if authored content produced valid cards
  const hasImages = ul.querySelector('img');
  const hasTitles = ul.querySelector('.cards-related-title');
  const hasValidContent = ul.children.length > 0 && (hasImages || hasTitles);

  if (!hasValidContent) {
    // No valid authored content — try loading from Related Content metadata
    ul.replaceChildren();
    const relatedMeta = document.querySelector('meta[name="related-content"]');
    if (relatedMeta) {
      const relatedPath = relatedMeta.content;
      const item = await fetchRelatedByPath(relatedPath);
      if (item) {
        // Resolve image path for local content serving
        let { image } = item;
        if (image && !image.startsWith('http') && !image.startsWith('/content/')) {
          const prefix = window.location.pathname.startsWith('/content/') ? '/content' : '';
          image = `${prefix}${item.image}`;
        }
        const card = buildCardFromData({ ...item, image });
        ul.append(card);
      }
    }
  }

  // Hide block if still no valid cards
  if (ul.children.length === 0) {
    block.style.display = 'none';
  }
}
