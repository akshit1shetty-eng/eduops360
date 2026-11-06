/**
 * upGrad brand tokens (source: "upGrad branding/upgrad-brand guidelines.pptx").
 *
 * Use these instead of ad-hoc hex values so every screen stays on-brand.
 * Tailwind equivalents live in index.html (`brand-*`, neutral `slate-*`/`gray-*`),
 * CSS equivalents live in src/index.css (`--ug-*`).
 */
export const BRAND = {
  /** Primary colours (mother brand) */
  red: '#E50913',
  black: '#000000',
  white: '#FFFFFF',
  /** Secondary colours */
  darkRed: '#9B000C',
  pink: '#F9C0C7',
  darkGrey: '#404041',
  lightGrey: '#D0D2D3',
  /** End stop of the official linear gradient (#E50913 → #BF2026) */
  gradientEnd: '#BF2026',
  /** Iconography red */
  iconRed: '#EE2C3C',
} as const;

export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.red}, ${BRAND.gradientEnd})`;

export const FONT_HEADING = "'Montserrat', 'Roboto', system-ui, sans-serif";
export const FONT_BODY = "'Roboto', system-ui, -apple-system, sans-serif";

/**
 * Categorical chart order, led by upGrad red. Validated (light surface) for
 * lightness band, chroma, colour-blind separation and normal-vision separation.
 * Assign in this fixed order; categories beyond the 8th fold into CHART_OTHER.
 */
export const CHART_COLORS = [
  '#E50913', // upGrad red
  '#2a78d6', // blue
  '#1f9e89', // teal
  '#eb6834', // orange
  '#6250d6', // violet
  '#c43d8a', // magenta
  '#3a8f3a', // green
  '#d9a21b', // gold
] as const;

/** Neutral used for "Other" / overflow categories. */
export const CHART_OTHER = '#A7A9AC';

export const chartColor = (index: number) => CHART_COLORS[index] ?? CHART_OTHER;
