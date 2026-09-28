import { toAppError } from '@hopium/core';
import type { TFunction } from 'i18next';

/** Plain, translated message for any thrown error. */
export function errorMessage(t: TFunction, err: unknown): string {
  const e = toAppError(err);
  const key = `errors.${e.code}` as const;
  const details = e.details ?? {};
  const translated = tKey(t, key, details);
  return translated === key ? t('errors.generic') : translated;
}

/** Map zod issue keys (e.g. 'username.tooShort') to translations. */
export function validationMessage(t: TFunction, key: string | undefined): string | null {
  if (!key) return null;
  const full = `validation.${key}`;
  const translated = tKey(t, full);
  return translated === full ? t('errors.invalid_input') : translated;
}

/** Translate a key that is only known at runtime (e.g. stored in a notification). */
export function tKey(t: TFunction, key: string, params?: Record<string, string | number>): string {
  return (t as unknown as (k: string, o?: object) => string)(key, params);
}
