export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  // Build accordion structure
  const container = document.createElement('div');
  container.className = 'accordion-principles-container';

  // Header row with label + expand all
  const header = document.createElement('div');
  header.className = 'accordion-principles-header';

  const label = document.createElement('span');
  label.className = 'accordion-principles-label';
  label.textContent = 'Our principles';

  const expandBtn = document.createElement('button');
  expandBtn.className = 'accordion-principles-expand-all';
  expandBtn.textContent = 'Expand All';
  expandBtn.setAttribute('aria-label', 'Expand all accordion items');

  header.append(label, expandBtn);
  container.append(header);

  // Build accordion items
  const items = [];
  rows.forEach((row) => {
    const cols = [...row.children];
    if (cols.length < 2) return;

    const titleText = cols[0]?.textContent?.trim() || '';
    const bodyText = cols[1]?.innerHTML || '';

    const item = document.createElement('div');
    item.className = 'accordion-principles-item';

    const button = document.createElement('button');
    button.className = 'accordion-principles-button';
    button.setAttribute('aria-expanded', 'false');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'accordion-principles-title';
    titleSpan.textContent = titleText;

    const icon = document.createElement('span');
    icon.className = 'accordion-principles-icon';
    icon.setAttribute('aria-hidden', 'true');

    button.append(titleSpan, icon);

    const panel = document.createElement('div');
    panel.className = 'accordion-principles-panel';
    panel.setAttribute('role', 'region');
    panel.hidden = true;
    panel.innerHTML = bodyText;

    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
      item.classList.toggle('active', !expanded);
    });

    item.append(button, panel);
    container.append(item);
    items.push({ item, button, panel });
  });

  // Expand/Collapse All
  expandBtn.addEventListener('click', () => {
    const allExpanded = items.every(({ button: btn }) => btn.getAttribute('aria-expanded') === 'true');
    items.forEach(({ item: itm, button: btn, panel: pnl }) => {
      btn.setAttribute('aria-expanded', String(!allExpanded));
      pnl.hidden = allExpanded;
      itm.classList.toggle('active', !allExpanded);
    });
    expandBtn.textContent = allExpanded ? 'Expand All' : 'Collapse All';
  });

  block.replaceChildren(container);
}
