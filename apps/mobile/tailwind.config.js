// Tailwind loads this file through jiti, so the TypeScript token module can be
// required directly — tokens.ts stays the single source of truth.
const {
  colorTokens,
  cssVarName,
  radius,
  fontFamily,
  typeScale,
  breakpoints,
} = require('../../packages/ui/src/tokens.ts');

// camelCase tokens become kebab-case classes: textMuted → text-text-muted.
const kebab = (name) => name.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();

const colors = Object.fromEntries(
  colorTokens.map((token) => [kebab(token), `rgb(var(${cssVarName(token)}) / <alpha-value>)`]),
);

const fontSize = Object.fromEntries(
  Object.entries(typeScale).map(([name, { fontSize: size, lineHeight }]) => [
    name,
    [`${size}px`, { lineHeight: `${lineHeight}px` }],
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontSize,
      borderRadius: Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, `${v}px`])),
      fontFamily: {
        heading: [fontFamily.heading],
        'heading-medium': [fontFamily.headingMedium],
        body: [fontFamily.body],
        'body-medium': [fontFamily.bodyMedium],
        'body-semibold': [fontFamily.bodySemibold],
      },
      screens: {
        tablet: `${breakpoints.tablet}px`,
        desktop: `${breakpoints.desktop}px`,
      },
    },
  },
  plugins: [],
};
