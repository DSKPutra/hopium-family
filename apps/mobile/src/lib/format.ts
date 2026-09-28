import {
  formatCompact,
  formatMoney,
  formatPct,
  formatQty,
  priceDecimals,
  type Decimal,
  type DecimalInput,
} from '@hopium/core';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSettings } from '@/stores/settings';

export const IDR_PER_USD_DEMO = '16250';

export function localeFor(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

export function timeAgo(t: TFunction, iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (s < 10) return t('common.timeAgo.now');
  if (s < 60) return t('common.timeAgo.seconds', { count: s });
  if (s < 3600) return t('common.timeAgo.minutes', { count: Math.floor(s / 60) });
  if (s < 86400) return t('common.timeAgo.hours', { count: Math.floor(s / 3600) });
  return t('common.timeAgo.days', { count: Math.floor(s / 86400) });
}

export function countdown(t: TFunction, targetIso: string | number, now = Date.now()): string {
  const ms = (typeof targetIso === 'number' ? targetIso : Date.parse(targetIso)) - now;
  if (ms <= 0) return t('common.countdown.ended');
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return t('common.countdown.days', { d, h });
  if (h > 0) return t('common.countdown.hours', { h, m });
  return t('common.countdown.minutes', { m, s: s % 60 });
}

export interface Formatters {
  locale: string;
  currency: 'USD' | 'IDR';
  /** Money in the display currency (USD or IDR). */
  money: (
    v: DecimalInput,
    opts?: { signed?: boolean; compact?: boolean; decimals?: number },
  ) => string;
  /** Always USD (fees, minimums, USDC). */
  usd: (v: DecimalInput, opts?: { signed?: boolean; decimals?: number }) => string;
  /** Prices adapt decimals for tiny memecoins. */
  price: (v: DecimalInput) => string;
  pct: (v: DecimalInput, opts?: { arrow?: boolean; signed?: boolean; decimals?: number }) => string;
  qty: (v: DecimalInput, maxDecimals?: number) => string;
  compact: (v: DecimalInput) => string;
  hidden: string;
}

export function useFormat(): Formatters {
  const { i18n } = useTranslation();
  const currency = useSettings((s) => s.displayCurrency);
  return useMemo(() => {
    const locale = localeFor(i18n.language);
    const fxRate = currency === 'IDR' ? IDR_PER_USD_DEMO : '1';
    return {
      locale,
      currency,
      money: (v, o) =>
        formatMoney(v, {
          locale,
          currency,
          fxRate,
          signed: o?.signed,
          compact: o?.compact,
          decimals: o?.decimals,
        }),
      usd: (v, o) =>
        formatMoney(v, { locale, currency: 'USD', signed: o?.signed, decimals: o?.decimals }),
      price: (v) =>
        currency === 'IDR'
          ? formatMoney(v, {
              locale,
              currency,
              fxRate,
              decimals: Math.max(0, priceDecimals(v) - 4),
            })
          : formatMoney(v, { locale, adaptive: true }),
      pct: (v, o) =>
        formatPct(v, { locale, arrow: o?.arrow, signed: o?.signed, decimals: o?.decimals }),
      qty: (v, maxDecimals) => formatQty(v, { locale, maxDecimals }),
      compact: (v) => formatCompact(v, { locale }),
      hidden: '••••••',
    };
  }, [currency, i18n.language]);
}

export const displaySymbol = (symbol: string, tags: string[] = []): string =>
  tags.includes('meme') ? `$${symbol}` : symbol;

export type { Decimal };
