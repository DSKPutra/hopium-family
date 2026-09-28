/**
 * Generates every brand asset from the shared logo geometry:
 *   assets/brand/logo-mark.svg, logo-wordmark(.light).svg, logo-full(.light).svg
 *   assets/images/icon.png (1024, opaque), adaptive-icon.png (1024, safe zone),
 *   splash-icon.png, favicon.png (48), og-image.png (1200×630)
 * Run: npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import opentype from 'opentype.js';
import sharp from 'sharp';

import { LOGO_COLORS, logoMarkSvg } from '../packages/ui/src/brand/logo';

const root = resolve(__dirname, '..');
const brandDir = join(root, 'apps/mobile/assets/brand');
const imagesDir = join(root, 'apps/mobile/assets/images');
mkdirSync(brandDir, { recursive: true });
mkdirSync(imagesDir, { recursive: true });

const fontPath = join(
  root,
  'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf',
);
const buf = readFileSync(fontPath);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

interface Wordmark {
  svgBody: string;
  width: number;
  height: number;
}

/** `hopium.family` as vector paths, with the dot in Moon Gold. */
function wordmark(textColor: string, fontSize = 200): Wordmark {
  const baseline = fontSize * 0.8;
  let x = 0;
  const parts: string[] = [];
  for (const [text, color] of [
    ['hopium', textColor],
    ['.', LOGO_COLORS.gold],
    ['family', textColor],
  ] as const) {
    const path = font.getPath(text, x, baseline, fontSize);
    parts.push(`<path d="${path.toPathData(2)}" fill="${color}"/>`);
    x += font.getAdvanceWidth(text, fontSize);
  }
  return { svgBody: parts.join(''), width: Math.ceil(x), height: Math.ceil(fontSize * 1.05) };
}

function wordmarkSvg(textColor: string): string {
  const w = wordmark(textColor);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.width} ${w.height}" width="${w.width}" height="${w.height}">${w.svgBody}</svg>`;
}

function fullLogoSvg(textColor: string): string {
  const w = wordmark(textColor);
  const markSize = w.height * 1.25;
  const gap = markSize * 0.12;
  const width = Math.ceil(markSize + gap + w.width);
  const height = Math.ceil(markSize);
  const mark = logoMarkSvg()
    .replace('<svg', `<svg x="0" y="0" width="${markSize}" height="${markSize}"`)
    .replace(/ width="1024" height="1024"/, '');
  const offsetY = (markSize - w.height) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${mark}<g transform="translate(${markSize + gap} ${offsetY})">${w.svgBody}</g></svg>`;
}

async function png(
  svg: string,
  file: string,
  size: number | { width: number; height: number },
  flatten?: string,
) {
  const dims = typeof size === 'number' ? { width: size, height: size } : size;
  let img = sharp(Buffer.from(svg), { density: 300 }).resize(dims.width, dims.height, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (flatten) img = img.flatten({ background: flatten });
  await img.png().toFile(file);
  console.log(`✓ ${file.replace(`${root}/`, '')}`);
}

async function main() {
  const files: [string, string][] = [
    ['logo-mark.svg', logoMarkSvg()],
    ['logo-wordmark.svg', wordmarkSvg(LOGO_COLORS.paper)],
    ['logo-wordmark.light.svg', wordmarkSvg(LOGO_COLORS.inkOnLight)],
    ['logo-full.svg', fullLogoSvg(LOGO_COLORS.paper)],
    ['logo-full.light.svg', fullLogoSvg(LOGO_COLORS.inkOnLight)],
  ];
  for (const [name, svg] of files) {
    writeFileSync(join(brandDir, name), `${svg}\n`);
    console.log(`✓ apps/mobile/assets/brand/${name}`);
  }

  // iOS icon: opaque, full-bleed brand background (no transparency allowed).
  await png(
    logoMarkSvg({ background: LOGO_COLORS.ink, scale: 0.8 }),
    join(imagesDir, 'icon.png'),
    1024,
    LOGO_COLORS.ink,
  );
  // Android adaptive foreground: keep the mark inside the 66% safe zone.
  await png(logoMarkSvg({ scale: 0.58 }), join(imagesDir, 'adaptive-icon.png'), 1024);
  await png(logoMarkSvg({ scale: 0.92 }), join(imagesDir, 'splash-icon.png'), 1024);
  await png(
    logoMarkSvg({ background: LOGO_COLORS.ink, scale: 0.92, cornerRadius: 220 }),
    join(imagesDir, 'favicon.png'),
    48,
  );
  await png(
    logoMarkSvg({ background: LOGO_COLORS.ink, scale: 0.85, cornerRadius: 230 }),
    join(imagesDir, 'apple-touch-icon.png'),
    180,
  );

  // Open Graph card for shared links.
  const w = wordmark(LOGO_COLORS.paper, 110);
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LOGO_COLORS.green}" stop-opacity="0.22"/><stop offset="1" stop-color="${LOGO_COLORS.violet}" stop-opacity="0.35"/></linearGradient></defs>
    <rect width="1200" height="630" fill="${LOGO_COLORS.ink}"/><rect width="1200" height="630" fill="url(#g)"/>
    ${logoMarkSvg()
      .replace('<svg', '<svg x="90" y="165" width="300" height="300"')
      .replace(/ width="1024" height="1024"/, '')}
    <g transform="translate(420 ${315 - w.height / 2 - 30})">${w.svgBody}</g>
    <text x="424" y="410" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#8A86A3">stay high on conviction.</text>
  </svg>`;
  await png(og, join(imagesDir, 'og-image.png'), { width: 1200, height: 630 }, LOGO_COLORS.ink);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
