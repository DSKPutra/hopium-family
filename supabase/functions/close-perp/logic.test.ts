import { assertEquals } from 'std/assert';
import { closeAmounts } from './logic.ts';

Deno.test('half close realizes half the PnL', () => {
  const r = closeAmounts({ side: 'long', entry: '100', size: '2', margin: '50', realized: '0' }, '110', 50);
  assertEquals(r.realized, '10');
  assertEquals(r.remainingSize, '1');
  assertEquals(r.full, false);
});
Deno.test('short loses when price rises', () => {
  const r = closeAmounts({ side: 'short', entry: '100', size: '1', margin: '50', realized: '0' }, '110', 100);
  assertEquals(r.realized, '-10');
  assertEquals(r.full, true);
});
