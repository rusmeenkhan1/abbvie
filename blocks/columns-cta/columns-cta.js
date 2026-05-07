export default function decorate(block) {
  // The block structure is a single row with multiple column divs.
  // Each column contains paragraph(s) of text and a paragraph with a CTA link.
  // No additional DOM transformation is needed; CSS handles the layout.
  const columns = block.querySelectorAll(':scope > div > div');
  columns.forEach((col) => {
    col.classList.add('columns-cta-column');
  });
}
