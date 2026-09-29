import { AppError } from '@hopium/core/errors';

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|io|xyz|net|org|app|gg|me)\b)/i;
const PROFANITY = ['fuck', 'shit', 'bitch', 'anjing', 'bangsat', 'kontol'];
const SPAM = ['free money', 'send me', 'dm for signals', 'guaranteed profit', 'pasti untung', 'airdrop claim'];

/** Basic profanity/spam filter and link blocking for posts and comments. */
export function moderateText(body: string): { ok: true } {
  const lower = body.toLowerCase();
  if (LINK.test(body)) throw new AppError('content_rejected', 'Links are not allowed in posts or comments.');
  if (SPAM.some((w) => lower.includes(w))) throw new AppError('content_rejected', 'This message looks like spam.');
  if (PROFANITY.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower))) throw new AppError('content_rejected', 'Please keep it respectful.');
  return { ok: true };
}
