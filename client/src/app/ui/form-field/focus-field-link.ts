export function focusFieldLink(event: MouseEvent) {
  const anchor = event.currentTarget as HTMLAnchorElement;
  const control = anchor.ownerDocument.getElementById(anchor.hash.slice(1));
  if (!control) return;
  event.preventDefault();
  control.focus({ preventScroll: true });
  control.scrollIntoView?.({ block: 'center' });
}
