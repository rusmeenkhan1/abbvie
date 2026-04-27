export default function decorate(doc) {
  const main = doc.querySelector('main');
  if (!main) return;
  main.classList.add('our-leaders-template');
}
