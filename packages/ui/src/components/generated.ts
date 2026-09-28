import { hashString } from '@hopium/core';

/** Deterministic brand-friendly gradient for an id (avatars, asset logos). */
export function gradientFor(id: string): [string, string] {
  const h = hashString(id);
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + ((h >> 9) % 80)) % 360;
  return [`hsl(${hue1}, 78%, 58%)`, `hsl(${hue2}, 72%, 46%)`];
}

export function initialsOf(name: string): string {
  const clean = name.replace(/^\$/, '').trim();
  if (!clean) return '?';
  const parts = clean.split(/[\s_.-]+/).filter(Boolean);
  const first = parts[0] ?? clean;
  const second = parts[1];
  return (second ? `${first[0]}${second[0]}` : first.slice(0, 2)).toUpperCase();
}
