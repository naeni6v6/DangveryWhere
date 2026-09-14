type Options = { onSnap: (expanded: boolean) => void };

/** Keep the map interactive while the handle resizes its containing sheet. */
export function sheetDrag(handle: HTMLButtonElement, options: Options) {
  const sheet = handle.parentElement!;
  let pointer: number | null = null;
  let startY = 0;
  let startHeight = 0;
  let moved = false;

  function down(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId;
    startY = event.clientY;
    startHeight = sheet.getBoundingClientRect().height;
    moved = false;
    handle.setPointerCapture(pointer);
  }

  function move(event: PointerEvent) {
    if (event.pointerId !== pointer) return;
    const delta = startY - event.clientY;
    if (Math.abs(delta) > 8) moved = true;
    if (!moved) return;
    const bottom = sheet.getBoundingClientRect().bottom;
    const top = sheet.parentElement?.getBoundingClientRect().top ?? 0;
    sheet.style.transition = 'none';
    sheet.style.height = `${Math.max(160, Math.min(bottom - top - 70, startHeight + delta))}px`;
  }

  function finish(event: PointerEvent) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    sheet.style.removeProperty('height');
    sheet.style.removeProperty('transition');
    const delta = startY - event.clientY;
    if (event.type === 'pointerup' && Math.abs(delta) > 30) options.onSnap(delta > 0);
  }

  function click(event: MouseEvent) {
    if (moved && event.detail > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    moved = false;
  }

  handle.addEventListener('pointerdown', down);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('click', click, true);
  return {
    update(next: Options) {
      options = next;
    },
    destroy() {
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      handle.removeEventListener('click', click, true);
    }
  };
}
