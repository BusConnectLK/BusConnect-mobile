import type { SeatLayout } from "./api";

/** One row of a seat grid — a seat's label, or null for an aisle/gap. Rows
 * can be different lengths (e.g. a bus's back row is often wider). */
export type SeatGrid = (string | null)[][];

/**
 * Expand a stored layout into a uniform 2D grid for rendering. Prefers the
 * newer freeform `grid` field (admin-edited layouts); falls back to the
 * legacy `rows` × shared `cols` template (+ optional flat `labels` override),
 * then to a plain 2+2 default if there's no layout at all. Ported from
 * BusConnect-web/src/lib/seat-layout.ts — keep both in sync if this changes.
 */
export function layoutToGrid(layout: SeatLayout | null, seatCount: number): SeatGrid {
  if (layout?.grid && layout.grid.length > 0) return layout.grid;

  const rows = layout?.rows ?? Math.ceil(seatCount / 4);
  const cols = layout?.cols ?? ["A", "B", null, "C", "D"];
  const labels = layout?.labels;

  const grid: SeatGrid = [];
  let i = 0;
  for (let r = 1; r <= rows; r++) {
    const row: (string | null)[] = [];
    for (const col of cols) {
      if (col === null) {
        row.push(null);
        continue;
      }
      if (i >= seatCount) {
        row.push(null);
        continue;
      }
      row.push(labels?.[i] ?? `${r}${col}`);
      i++;
    }
    grid.push(row);
  }
  return grid;
}
