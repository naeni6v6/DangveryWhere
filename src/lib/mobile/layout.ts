export type SheetLevel = 0 | 1 | 2;

export function sheetHeights(available: number): [number, number, number] {
  const height = Math.max(0, available);
  return [Math.min(168, height * 0.36), height * 0.62, height];
}

/** Keep the selected place visible above the detail sheet at every stop. */
export function detailSheetHeights(available: number, viewport: number): [number, number, number] {
  const height = Math.max(0, available);
  return [0.5, 1 / 3, 0.25].map((ratio) => Math.max(0, height - viewport * ratio)) as [
    number,
    number,
    number
  ];
}

export function selectedPlaceTarget(width: number, height: number, viewport: number, top = 0) {
  const margin = Math.min(48, height / 2);
  return {
    x: width / 2,
    y: Math.max(margin, Math.min(height - margin, viewport / 6 - top))
  };
}

/** Project the release velocity briefly, then settle at one of the three stops. */
export function snapSheetLevel(
  height: number,
  stops: readonly [number, number, number],
  velocity = 0
): SheetLevel {
  const projected = height + Math.max(-1.5, Math.min(1.5, velocity)) * 140;
  return stops.reduce<SheetLevel>(
    (closest, stop, index) =>
      Math.abs(stop - projected) < Math.abs(stops[closest] - projected)
        ? (index as SheetLevel)
        : closest,
    0
  );
}

/** Pack whole chips onto each swipe page, preserving their original order. */
export function packChipPages(widths: readonly number[], available: number, gap = 6): number[][] {
  const pages: number[][] = [];
  let used = 0;
  for (const [index, width] of widths.entries()) {
    const last = pages[pages.length - 1];
    if (!last || used + gap + width > available) {
      pages.push([index]);
      used = width;
    } else {
      last.push(index);
      used += gap + width;
    }
  }
  return pages;
}
