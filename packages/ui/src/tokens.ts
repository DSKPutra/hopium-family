/**
 * hopium.family design tokens — the single source of truth for color, type,
 * spacing, radius and motion. Tailwind (NativeWind) reads colors through CSS
 * variables generated from `palette` (see `themeVars`), so every className like
 * `bg-surface` or `text-gain` resolves to the values below in both themes.
 */

export type ColorScheme = 'dark' | 'light';

const dark = {
  bg: '#07060F',
  surface: '#12101F',
  surface2: '#1C1930',
  border: '#2A2645',
  primary: '#3DFFA8',
  secondary: '#8B5CFF',
  accent: '#FFD166',
  gain: '#3DFFA8',
  loss: '#FF4D6D',
  warning: '#FFB547',
  text: '#F5F3FF',
  textMuted: '#8A86A3',
  onPrimary: '#07060F',
} as const;

export type ColorToken = keyof typeof dark;
export type Palette = Record<ColorToken, string>;

const light: Palette = {
  bg: '#FAF9FF',
  surface: '#FFFFFF',
  surface2: '#F1EFFA',
  border: '#E2DFF0',
  primary: '#00B86B',
  secondary: '#6D3BF5',
  accent: '#E0A800',
  gain: '#00A35C',
  loss: '#E0244A',
  warning: '#C77700',
  text: '#14121F',
  textMuted: '#6B6785',
  // Spec value was #FFFFFF, but white on #00B86B is ~2.6:1 and fails WCAG AA.
  // Dark ink on Hopium Green reaches ~7.7:1 while keeping the brand color.
  onPrimary: '#07060F',
};

export const palette: Record<ColorScheme, Palette> = { dark, light };

export const colorTokens = Object.keys(dark) as ColorToken[];

/** Brand gradient, 135° from Hopium Green to Dream Violet. */
export const hopeGradient = {
  colors: ['#3DFFA8', '#8B5CFF'] as const,
  angle: 135,
  /** expo-linear-gradient start/end equivalent of 135°. */
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** Podium / crown metals for the leaderboard. */
export const medal = {
  gold: '#FFD166',
  silver: '#C9CCD6',
  bronze: '#D08C5B',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontFamily = {
  headingMedium: 'SpaceGrotesk_500Medium',
  heading: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
} as const;

export type TypeVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'micro';

export const typeScale: Record<TypeVariant, { fontSize: number; lineHeight: number }> = {
  display: { fontSize: 40, lineHeight: 44 },
  h1: { fontSize: 28, lineHeight: 34 },
  h2: { fontSize: 22, lineHeight: 28 },
  h3: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11, lineHeight: 14 },
};

export const motion = {
  spring: { damping: 18, stiffness: 180 },
  tickFlashMs: 400,
} as const;

export const breakpoints = {
  tablet: 768,
  desktop: 1024,
} as const;

export const layout = {
  sidebarWidth: 240,
  contentMaxWidth: 680,
  rightRailWidth: 340,
  minTouchTarget: 44,
} as const;

/** `#3DFFA8` → `61 255 168` (space-separated, for `rgb(var(--x) / <alpha>)`). */
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export const cssVarName = (token: ColorToken): `--color-${ColorToken}` => `--color-${token}`;

/** CSS variable map for a scheme, applied at the app root with NativeWind `vars()`. */
export function themeVars(scheme: ColorScheme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of colorTokens) {
    out[cssVarName(token)] = hexToRgbTriplet(palette[scheme][token]);
  }
  return out;
}
