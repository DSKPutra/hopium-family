import { assertThrows } from 'std/assert';
import { moderateText } from '../_shared/moderation.ts';

Deno.test('allows normal text', () => void moderateText('solid thesis, watching the breakout'));
Deno.test(
  'blocks links',
  () => void assertThrows(() => moderateText('join www.pump.xyz'), Error, 'Links'),
);
Deno.test(
  'blocks spam and profit promises',
  () => void assertThrows(() => moderateText('guaranteed profit, dm for signals')),
);
Deno.test('blocks profanity', () => void assertThrows(() => moderateText('you shit')));
