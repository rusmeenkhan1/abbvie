export default function decorate(block) {
  if (!block.querySelector(':scope > div:first-child picture') && !block.querySelector(':scope > div:first-child img')) {
    block.classList.add('no-image');
  }
}
