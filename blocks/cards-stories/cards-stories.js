export default function decorate(block) {
  const rows = [...block.children];

  rows.forEach((row) => {
    const columns = [...row.children];
    if (columns.length < 2) return;

    const imageCol = columns[0];
    const contentCol = columns[1];

    // Process image column - handle both img and link-to-image patterns
    let img = imageCol.querySelector('img');
    if (!img) {
      const link = imageCol.querySelector('a[href]');
      const isImageLink = link && (/\.(jpg|jpeg|png|gif|webp|svg)/i.test(link.href)
        || link.href.includes('scene7'));
      if (isImageLink) {
        img = document.createElement('img');
        img.src = link.href;
        img.alt = link.textContent.trim() || '';
        img.loading = 'lazy';
      }
    }
    if (img) {
      imageCol.innerHTML = '';
      imageCol.appendChild(img);
    }

    // Process content column
    const children = [...contentCol.children];
    const h4 = contentCol.querySelector('h4');

    // Find the link paragraph (last p with an anchor)
    let linkParagraph = null;
    for (let i = children.length - 1; i >= 0; i -= 1) {
      if (children[i].tagName === 'P' && children[i].querySelector('a')) {
        linkParagraph = children[i];
        break;
      }
    }

    const preh4 = [];
    const posth4 = [];
    let passedH4 = false;

    children.forEach((child) => {
      if (child === h4) {
        passedH4 = true;
        return;
      }
      if (child === linkParagraph) return;
      if (!passedH4) {
        preh4.push(child);
      } else {
        posth4.push(child);
      }
    });

    contentCol.innerHTML = '';

    if (preh4.length > 0) {
      preh4[0].className = 'cards-stories-date';
      contentCol.appendChild(preh4[0]);
    }

    if (preh4.length > 1) {
      preh4[1].className = 'cards-stories-category';
      contentCol.appendChild(preh4[1]);
    }

    if (h4) {
      contentCol.appendChild(h4);
    }

    posth4.forEach((p) => {
      p.className = 'cards-stories-description';
      contentCol.appendChild(p);
    });

    if (linkParagraph) {
      linkParagraph.className = 'cards-stories-link';
      contentCol.appendChild(linkParagraph);
    }
  });
}
