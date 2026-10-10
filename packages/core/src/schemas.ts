import { z } from 'zod';

import { isValidAddress } from './chains';
import { gt, isValidDecimal, lte } from './money';
import { CHAINS, INTERESTS } from './types';

// zod v4 probes `new Function` to enable its JIT; the web CSP forbids eval, so
// the probe would log a violation. Validation is identical without the JIT.
z.config({ jitless: true });

export const RESERVED_USERNAMES = [
  'admin',
  'hopium',
  'support',
  'root',
  'system',
  'official',
  'help',
  'moderator',
  'deleted',
];

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'username.tooShort')
  .max(20, 'username.tooLong')
  .regex(/^[a-z0-9_]+$/, 'username.invalidChars')
  .refine((v) => !RESERVED_USERNAMES.includes(v), 'username.reserved');

export const emailSchema = z.string().trim().toLowerCase().email('email.invalid');
export const otpSchema = z.string().regex(/^\d{6}$/, 'otp.invalid');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'profile.nameRequired')
  .max(40, 'profile.nameTooLong');
export const bioSchema = z.string().max(160, 'profile.bioTooLong');

export const profileSchema = z.object({
  displayName: displayNameSchema,
  bio: bioSchema,
  avatarUrl: z.string().nullable(),
});

export const interestsSchema = z
  .array(z.enum(INTERESTS as [string, ...string[]]))
  .min(1, 'interests.pickOne');

export const MIN_AGE = 18;
export function isAdult(birthYear: number, now = new Date()): boolean {
  // Conservative: someone born in `birthYear` may not have had their birthday yet.
  return now.getFullYear() - birthYear - 1 >= MIN_AGE;
}

export const birthYearSchema = (now = new Date()) =>
  z.coerce
    .number()
    .int('birthYear.invalid')
    .min(1900, 'birthYear.invalid')
    .max(now.getFullYear(), 'birthYear.invalid');

export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/, 'country.invalid');

export const decimalStringSchema = z.string().trim().refine(isValidDecimal, 'amount.invalid');
export const positiveDecimalSchema = decimalStringSchema.refine((v) => gt(v, 0), 'amount.positive');

export const chainSchema = z.enum(CHAINS as [string, ...string[]]);

export const withdrawSchema = z
  .object({
    assetId: z.string().min(1),
    chain: chainSchema,
    address: z.string().trim().min(1, 'address.required'),
    amount: positiveDecimalSchema,
  })
  .refine((v) => isValidAddress(v.chain as never, v.address), {
    message: 'address.invalid',
    path: ['address'],
  });

export const THESIS_BODY_MAX = 2000;
export const COMMENT_MAX = 500;

export const thesisSchema = z.object({
  assetId: z.string().min(1, 'thesis.assetRequired'),
  direction: z.enum(['long', 'short']),
  targetPrice: positiveDecimalSchema,
  invalidationPrice: positiveDecimalSchema,
  timeframeEnd: z.string().refine((v) => Date.parse(v) > Date.now(), 'thesis.timeframePast'),
  body: z.string().trim().min(10, 'thesis.bodyTooShort').max(THESIS_BODY_MAX, 'thesis.bodyTooLong'),
  imageUrl: z.string().nullable(),
});

export const commentSchema = z
  .string()
  .trim()
  .min(1, 'comment.empty')
  .max(COMMENT_MAX, 'comment.tooLong');

export const slippageBpsSchema = z.number().int().min(1).max(2000);

export const leverageSchema = (maxLeverage: number) => z.number().min(1).max(maxLeverage);

export const priceAlertSchema = z.object({
  assetId: z.string().min(1),
  condition: z.enum(['above', 'below', 'pct_change']),
  value: positiveDecimalSchema.refine((v) => lte(v, '1000000000000'), 'amount.tooLarge'),
});

export type ThesisInput = z.infer<typeof thesisSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
