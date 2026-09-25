/** Deterministic PRNG (mulberry32) so demo data is stable across reloads. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → 32-bit seed. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const rngFor = (...parts: (string | number)[]): Rng =>
  mulberry32(hashString(parts.join(':')));

/** Standard normal via Box–Muller. */
export function gaussian(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const randInt = (rng: Rng, min: number, maxInclusive: number): number =>
  Math.floor(rng() * (maxInclusive - min + 1)) + min;

export const between = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty list');
  return items[Math.floor(rng() * items.length)] as T;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Hex-ish id from an rng (not cryptographically secure; demo only). */
export function rngId(rng: Rng, prefix = ''): string {
  let s = '';
  for (let i = 0; i < 16; i++) s += Math.floor(rng() * 16).toString(16);
  return `${prefix}${s}`;
}

let counter = 0;
/** Runtime-unique id for new records. */
export function newId(prefix = ''): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function fakeTxHash(chain: string, rng: Rng = Math.random): string {
  const hex = () => Math.floor(rng() * 16).toString(16);
  if (chain === 'solana') {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let s = '';
    for (let i = 0; i < 88; i++) s += alphabet[Math.floor(rng() * alphabet.length)];
    return s;
  }
  let s = '0x';
  for (let i = 0; i < 64; i++) s += hex();
  return s;
}
