// These generated illustrations are placeholders, not product photography.
export function placeholderPath(name) {
  const fileName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-$/, '');
  return '/images/placeholders/' + fileName + '.svg';
}
