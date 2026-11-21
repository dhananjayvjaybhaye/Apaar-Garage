import { motionLevel } from '../motion/motion-policy';

export function flyToCart(source: HTMLElement, photo?: string, layer?: HTMLElement, from?: HTMLElement | null) {
  const document = source.ownerDocument;
  const view = document.defaultView;
  const level = motionLevel(view);
  if (level === 'reduced' || (level !== 'full' && !layer) || !source.isConnected || !source.animate) return;
  const target = document.getElementById('cart-trigger');
  if (!target) return;

  const start = (from ?? source).getBoundingClientRect();
  const end = target.getBoundingClientRect();
  const bounce = () => target.querySelectorAll<HTMLElement>('.icon-cart, .count').forEach((element) => element.animate(
    [{ transform: 'none' }, { transform: 'translateY(-5px) rotate(-7deg) scale(1.13)' }, { transform: 'none' }],
    { duration: 340, easing: 'cubic-bezier(.2,.7,.25,1)' },
  ));
  if (!end.width || !start.width) return;

  const image = photo ? document.createElement('img') : document.createElement('span');
  if (photo && image instanceof HTMLImageElement) {
    image.src = photo;
    image.alt = '';
  }
  image.className = 'cart-flight' + (photo ? ' cart-flight-image' : '');
  image.setAttribute('aria-hidden', 'true');
  image.style.left = start.left + start.width / 2 + 'px';
  image.style.top = start.top + start.height / 2 + 'px';
  (layer ?? document.body).append(image);

  const x = end.left + end.width / 2 - start.left - start.width / 2;
  const y = end.top + end.height / 2 - start.top - start.height / 2;
  const flight = image.animate([
    { transform: 'translate(-50%, -50%) scale(.8)', opacity: 0.95 },
    { transform: 'translate(calc(-50% + ' + x / 2 + 'px), calc(-50% + ' + (y / 2 - 45) + 'px)) scale(.65)', opacity: 0.95 },
    { transform: 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px)) scale(.15)', opacity: 0 },
  ], { duration: 480, easing: 'cubic-bezier(.3,.6,.25,1)' });
  void flight.finished.then(bounce, () => {}).finally(() => image.remove());
}
