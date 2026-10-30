export const POINTS_PER_INCH = 72;

/** Common trim sizes accepted by both KDP and IngramSpark (inches). */
export const TRIM_SIZES = [
  { id: "5x8", label: '5" × 8"', width: 5, height: 8 },
  { id: "5.25x8", label: '5.25" × 8"', width: 5.25, height: 8 },
  { id: "5.5x8.5", label: '5.5" × 8.5"', width: 5.5, height: 8.5 },
  { id: "6x9", label: '6" × 9"', width: 6, height: 9 },
] as const;

export type TrimId = (typeof TRIM_SIZES)[number]["id"];

export type PrintSettings = {
  trim: TrimId;
  fontSize: number; // pt
  lineHeight: number; // multiple of font size
  justified: boolean;
  hyphenate: boolean;
  dropCap: boolean;
  beginOnRight: boolean;
  includeToc: boolean;
  widowsOrphans: number; // minimum lines kept together at page breaks
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  trim: "5.5x8.5",
  fontSize: 11,
  lineHeight: 1.4,
  justified: true,
  hyphenate: true,
  dropCap: true,
  beginOnRight: true,
  includeToc: true,
  widowsOrphans: 2,
};

export type PrintStats = { pages: number; blankPagesInserted: number; ms: number };

/**
 * Mirrored margins in points. KDP's minimum gutter grows with page count, so the inside
 * margin steps up for longer books.
 */
export function marginsFor(pageCountEstimate: number) {
  const inside = pageCountEstimate <= 150 ? 0.625 : pageCountEstimate <= 300 ? 0.75 : 0.875;
  return {
    top: 0.75 * POINTS_PER_INCH,
    bottom: 0.75 * POINTS_PER_INCH,
    inside: inside * POINTS_PER_INCH,
    outside: 0.5 * POINTS_PER_INCH,
  };
}
