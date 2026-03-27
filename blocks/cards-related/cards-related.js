export default function decorate(block) {
  const rows = [...block.children];
  const ul = document.createElement('ul');
  ul.className = 'cards-related-list';

  rows.forEach((row) => {
    const cols = [...row.children];
    if (cols.length < 2) return;

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

    // Extract content from paragraphs
    const paragraphs = [...textCol.querySelectorAll('p')];
    paragraphs.forEach((p) => {
      const link = p.querySelector('a');
      const strong = p.querySelector('strong');

      if (link) {
        // CTA link
        const cta = document.createElement('p');
        cta.className = 'cards-related-cta';
        const a = document.createElement('a');
        a.href = link.href;
        a.textContent = link.textContent;
        cta.append(a);
        cardBodyDiv.append(cta);
      } else if (strong) {
        // Title
        const title = document.createElement('h4');
        title.className = 'cards-related-title';
        title.textContent = strong.textContent;
        cardBodyDiv.append(title);
      } else if (p.textContent.trim()) {
        // Category or description
        const text = p.textContent.trim();
        // Short text without periods is category, longer text is description
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

    // Wrap the whole card in a link if there's a CTA
    const ctaLink = cardBodyDiv.querySelector('.cards-related-cta a');
    if (ctaLink) {
      const wrapper = document.createElement('a');
      wrapper.href = ctaLink.href;
      wrapper.className = 'cards-related-link';
      wrapper.append(cardImageDiv, cardBodyDiv);
      li.replaceChildren(wrapper);
    }

    ul.append(li);
  });

  block.replaceChildren(ul);
}
