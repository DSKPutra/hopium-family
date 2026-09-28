/** Joins class names, skipping falsy values. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Visible keyboard focus ring on web; no effect on native. */
export const focusRing =
  'web:outline-none web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-primary';
