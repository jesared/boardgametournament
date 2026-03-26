export const RANKING_POINTS: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
};

export function pointsForPosition(position?: number | null) {
  if (!position || position <= 0) return 0;
  return RANKING_POINTS[position] ?? 1;
}

export function parseOptionalInt(value: FormDataEntryValue | null) {
  if (value === null) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric;
}
