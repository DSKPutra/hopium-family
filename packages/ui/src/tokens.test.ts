import { contrastRatio } from './contrast';
import { colorTokens, hexToRgbTriplet, palette, themeVars, type ColorToken } from './tokens';

describe('tokens', () => {
  it('both schemes define every token', () => {
    expect(Object.keys(palette.light).sort()).toEqual([...colorTokens].sort());
  });

  it('converts hex to rgb triplets', () => {
    expect(hexToRgbTriplet('#3DFFA8')).toBe('61 255 168');
    expect(() => hexToRgbTriplet('#abc')).toThrow();
  });

  it('builds css variables for NativeWind', () => {
    expect(themeVars('dark')['--color-bg']).toBe('7 6 15');
  });
});

describe('WCAG AA contrast', () => {
  // [foreground, background, minimum ratio]: 4.5 body text, 3 large text / UI.
  const pairs: [ColorToken, ColorToken, number][] = [
    ['text', 'bg', 4.5],
    ['text', 'surface', 4.5],
    ['text', 'surface2', 4.5],
    ['textMuted', 'bg', 4.5],
    ['textMuted', 'surface', 4.5],
    ['onPrimary', 'primary', 4.5],
    ['gain', 'surface', 3],
    ['loss', 'surface', 3],
    ['warning', 'surface', 3],
    ['secondary', 'surface', 3],
  ];

  for (const scheme of ['dark', 'light'] as const) {
    for (const [fg, bg, min] of pairs) {
      it(`${scheme}: ${fg} on ${bg} ≥ ${min}`, () => {
        expect(contrastRatio(palette[scheme][fg], palette[scheme][bg])).toBeGreaterThanOrEqual(min);
      });
    }
  }
});
