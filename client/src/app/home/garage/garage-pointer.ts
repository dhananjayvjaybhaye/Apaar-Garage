import type { Product } from '../../catalog/product';
import { heroScene } from '../hero.config';

interface GaragePointerOptions {
  pick: (x: number, y: number) => Product | undefined;
  frame: () => void;
  select: (product: Product, point: { x: number; y: number }) => void;
  prefetch: (product: Product) => void;
  hover?: (item: { product: Product; x: number; y: number } | undefined) => void;
}

export function connectGaragePointer(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  options: GaragePointerOptions,
) {
  const { pick, frame } = options;
  let mouse: { x: number; y: number } | null = null;
  let pressed: { x: number; y: number } | undefined;
  let drag: { x: number; y: number } | undefined;
  let touch: number | undefined;
  let hovered: Product | undefined;
  let mx = 0;
  let my = 0;

  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId === touch && pressed) {
        const offset = (px: number) => Math.max(-1, Math.min(1, px / heroScene.dragRangePx));
        drag = { x: offset(event.clientX - pressed.x), y: offset(event.clientY - pressed.y) };
      } else if (event.pointerType === 'mouse') {
        mouse = { x: event.offsetX, y: event.offsetY };
      } else return;
      frame();
    },
    { passive: true, signal },
  );

  canvas.addEventListener(
    'pointerleave',
    () => {
      mouse = null;
      frame();
    },
    { signal },
  );

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      pressed = { x: event.clientX, y: event.clientY };
      if (event.pointerType === 'touch') {
        touch = event.pointerId;
        const product = pick(event.clientX, event.clientY);
        if (product) options.prefetch(product);
      }
    },
    { passive: true, signal },
  );

  function clearDrag(event: PointerEvent) {
    if (event.pointerId !== touch) return;
    touch = undefined;
    drag = undefined;
    frame();
  }
  canvas.addEventListener('pointerup', clearDrag, { signal });
  canvas.addEventListener('pointercancel', clearDrag, { signal });
  canvas.addEventListener(
    'click',
    (event) => {
      const start = pressed;
      pressed = undefined;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
      const product = pick(event.clientX, event.clientY);
      if (product) options.select(product, { x: event.clientX, y: event.clientY });
    },
    { signal },
  );

  return {
    parallax() {
      const targetX = mouse ? (mouse.x / canvas.clientWidth) * 2 - 1 : (drag?.x ?? 0);
      const targetY = mouse ? (mouse.y / canvas.clientHeight) * 2 - 1 : (drag?.y ?? 0);
      mx += (targetX - mx) * 0.18;
      my += (targetY - my) * 0.18;
      return { mx, my };
    },
    hover() {
      const previous = hovered;
      if (mouse) {
        const rect = canvas.getBoundingClientRect();
        hovered = pick(
          rect.left + (mouse.x * rect.width) / canvas.clientWidth,
          rect.top + (mouse.y * rect.height) / canvas.clientHeight,
        );
      } else hovered = undefined;
      if (hovered?.slug !== previous?.slug) {
        if (hovered) options.prefetch(hovered);
        options.hover?.(hovered && mouse ? { product: hovered, ...mouse } : undefined);
        canvas.classList.toggle('garage-hovering', Boolean(hovered));
      }
      return hovered;
    },
  };
}
