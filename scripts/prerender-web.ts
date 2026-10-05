/**
 * Prerenders share metadata for the SPA web export. Link-preview crawlers do
 * not run JavaScript, so for every catalog asset, perp market, demo trader and
 * seeded thesis this writes:
 *   dist/<route>/index.html — the SPA shell with its own <title> and OG tags
 *   dist/og/<kind>/<id>.jpg — a 1200×630 Open Graph card
 * Vercel and Netlify serve these files before falling back to the SPA rewrite.
 * Runs after `expo export` (see apps/mobile `export:web`).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import opentype from 'opentype.js';
import sharp from 'sharp';

import {
  CATALOG,
  createMockProviders,
  DemoBackend,
  formatMoney,
  PERP_BASES,
} from '../packages/core/src';
import { LOGO_COLORS, logoMarkSvg } from '../packages/ui/src/brand/logo';
import en from '../apps/mobile/src/i18n/en.json';

const SEED = 20260924;
/** Absolute origin for OG URLs; set SITE_URL when deploying to a non-production host. */
const SITE = (process.env.SITE_URL ?? 'https://hopium.family').replace(/\/$/, '');
const root = resolve(__dirname, '..');
const dist = join(root, 'apps/mobile/dist');

const C = {
  bg: '#07060F',
  surface: '#12101F',
  text: '#F5F3FF',
  muted: '#8A86A3',
  gain: '#3DFFA8',
  loss: '#FF4D6D',
  violet: '#8B5CFF',
};

function loadFont(weight: string): opentype.Font {
  const file = join(
    root,
    `node_modules/@expo-google-fonts/space-grotesk/${weight}/SpaceGrotesk_${weight}.ttf`,
  );
  const buf = readFileSync(file);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
const bold = loadFont('700Bold');
const regular = loadFont('400Regular');

/** Removes characters the font can't draw (emoji, symbols outside its glyph set). */
function drawable(font: opentype.Font, text: string): string {
  return [...text]
    .filter((ch) => ch === ' ' || font.charToGlyph(ch).index > 0)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Path data with any command that opentype emitted with NaN coordinates removed. */
const cleanPath = (d: string): string => d.replace(/[MLQCZ][^MLQCZ]*NaN[^MLQCZ]*/g, '');

/** Text as an SVG path, shrunk to fit `maxWidth`, with an ellipsis if still too long. */
function textPath(
  font: opentype.Font,
  raw: string,
  opts: { x: number; y: number; size: number; maxWidth: number; fill: string; minSize?: number },
): string {
  let text = drawable(font, raw);
  let size = opts.size;
  const min = opts.minSize ?? opts.size;
  while (size > min && font.getAdvanceWidth(text, size) > opts.maxWidth) size -= 2;
  if (font.getAdvanceWidth(text, size) > opts.maxWidth) {
    while (text.length > 1 && font.getAdvanceWidth(`${text}…`, size) > opts.maxWidth)
      text = text.slice(0, -1).trimEnd();
    text = `${text}…`;
  }
  const d = cleanPath(font.getPath(text, opts.x, opts.y, size).toPathData(1));
  return `<path d="${d}" fill="${opts.fill}"/>`;
}

function wordmark(x: number, y: number, size: number): string {
  let cx = x;
  const parts: string[] = [];
  for (const [text, color] of [
    ['hopium', C.text],
    ['.', LOGO_COLORS.gold],
    ['family', C.text],
  ] as const) {
    parts.push(
      `<path d="${cleanPath(bold.getPath(text, cx, y, size).toPathData(1))}" fill="${color}"/>`,
    );
    cx += bold.getAdvanceWidth(text, size);
  }
  return parts.join('');
}

interface Card {
  eyebrow: string;
  title: string;
  titleColor?: string;
  lines: string[];
}

function cardSvg(card: Card): string {
  const mark = logoMarkSvg()
    .replace('<svg', '<svg x="72" y="56" width="72" height="72"')
    .replace(/ width="1024" height="1024"/, '');
  const lines = card.lines
    .slice(0, 3)
    .map((line, i) =>
      textPath(regular, line, {
        x: 72,
        y: 400 + i * 52,
        size: 36,
        minSize: 28,
        maxWidth: 1056,
        fill: C.muted,
      }),
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="0.9" cy="0.1" r="0.7"><stop offset="0" stop-color="${C.violet}" stop-opacity="0.45"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0.05" cy="1" r="0.6"><stop offset="0" stop-color="${C.gain}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${C.bg}"/>
  <rect width="1200" height="630" fill="url(#g1)"/>
  <rect width="1200" height="630" fill="url(#g2)"/>
  ${mark}
  ${wordmark(160, 108, 44)}
  ${textPath(bold, card.eyebrow, { x: 72, y: 232, size: 34, maxWidth: 1056, fill: C.violet })}
  ${textPath(bold, card.title, { x: 72, y: 330, size: 96, minSize: 56, maxWidth: 1056, fill: card.titleColor ?? C.text })}
  ${lines}
  ${textPath(regular, 'stay high on conviction.', { x: 72, y: 586, size: 28, maxWidth: 700, fill: C.muted })}
</svg>`;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const shell = readFileSync(join(dist, 'index.html'), 'utf8');

function pageHtml(title: string, description: string, path: string, image: string): string {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const url = `${SITE}${path}`;
  const tags = [
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE}${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="hopium.family">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${SITE}${image}">`,
    `<link rel="canonical" href="${url}">`,
  ].join('\n');
  return shell
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${d}">\n${tags}`,
    );
}

function write(file: string, data: string | Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}

interface Page {
  paths: string[];
  image: string;
  title: string;
  description: string;
  card: Card;
}

const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');

async function main(): Promise<void> {
  const providers = createMockProviders({ latency: [0, 0], failureRate: 0, seed: SEED });
  const demo = new DemoBackend(providers, { seed: SEED, engines: false });
  const db = demo.inspect();
  const price = (assetId: string): string =>
    formatMoney(providers.marketData.priceOf(assetId), { adaptive: true });
  const pages: Page[] = [];

  for (const a of CATALOG) {
    const sym = a.class === 'crypto' ? `$${a.symbol}` : a.symbol;
    const kind = a.class === 'stock_token' ? 'stock token · 24/7' : 'crypto';
    const title = fill(en.meta.asset, { symbol: sym });
    const description = `${a.name} (${sym}) live price, chart and what the family is trading on hopium.family.`;
    pages.push({
      paths: [`/asset/${a.symbol}`, `/a/${a.symbol}`],
      image: `/og/a/${a.symbol}.jpg`,
      title,
      description,
      card: { eyebrow: kind, title: sym, lines: [a.underlyingName ?? a.name, price(a.id)] },
    });
  }

  for (const base of PERP_BASES) {
    const market = `${base}-PERP`;
    pages.push({
      paths: [`/perps/${market}`],
      image: `/og/perps/${market}.jpg`,
      title: `${market} · hopium.family`,
      description: `${base} perpetual futures: mark price, funding and open interest. Leveraged trading carries liquidation risk.`,
      card: {
        eyebrow: 'perpetual futures',
        title: market,
        lines: [price(base.toLowerCase())],
      },
    });
  }

  const profiles = Object.values(db.profiles).filter((p) => p.isDemoBot);
  const usernameOf = new Map(profiles.map((p) => [p.id, p.username]));
  for (const p of profiles) {
    const title = fill(en.meta.user, { username: p.username });
    pages.push({
      paths: [`/user/${p.username}`, `/u/${p.username}`],
      image: `/og/u/${p.username}.jpg`,
      title,
      description: p.bio || `${p.displayName} trades on hopium.family.`,
      card: { eyebrow: `${p.tier} · trader`, title: `@${p.username}`, lines: [p.bio] },
    });
  }

  for (const th of db.theses) {
    const username = usernameOf.get(th.authorId);
    if (!username) continue;
    const dir = th.direction === 'long' ? 'LONG' : 'SHORT';
    const sym = th.symbol.startsWith('$') ? th.symbol : `$${th.symbol}`;
    const title = fill(en.meta.thesis, { direction: dir, symbol: sym, username });
    pages.push({
      paths: [`/thesis/${th.id}`, `/t/${th.id}`],
      image: `/og/t/${th.id}.jpg`,
      title,
      description: th.body.slice(0, 200),
      card: {
        eyebrow: `thesis by @${username} · ${th.status}`,
        title: `${dir} ${sym}`,
        titleColor: th.direction === 'long' ? C.gain : C.loss,
        lines: [
          `target ${formatMoney(th.targetPrice, { adaptive: true })} · invalidation ${formatMoney(th.invalidationPrice, { adaptive: true })}`,
          th.body,
        ],
      },
    });
  }

  for (const page of pages) {
    const png = await sharp(Buffer.from(cardSvg(page.card)))
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    write(join(dist, page.image), png);
    for (const path of page.paths)
      write(
        join(dist, path, 'index.html'),
        pageHtml(page.title, page.description, path, page.image),
      );
  }
  console.log(`✓ prerendered ${pages.length} share pages`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
