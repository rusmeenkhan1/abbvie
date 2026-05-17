export default function decorate(block) {
  // The block has a single row with 3 columns: heading, description, and CTA link.
  // Remove any button classes that AEM auto-decoration may have added,
  // since we style the link as our own button.
  const link = block.querySelector('a');
  if (link) {
    link.classList.remove('button', 'primary', 'secondary');
    const wrapper = link.closest('.button-container, .button-wrapper');
    if (wrapper) {
      wrapper.replaceWith(link);
    }
  }
}
