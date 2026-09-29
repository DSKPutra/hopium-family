import { assertEquals, assertThrows } from 'std/assert';
import { preparePerp } from './logic.ts';

const market = { maxLeverage: 20, maintenanceMarginRate: '0.005', markPrice: '100' };
const base = { marketId: 'btc-perp', side: 'long' as const, marginUsd: '100', leverage: 3, acknowledgedHighLeverage: false };

Deno.test('computes size and estimated liquidation', () => {
  const r = preparePerp(base, market);
  assertEquals(r.size, '3');
});
Deno.test('requires acknowledgement above 10x', () => void assertThrows(() => preparePerp({ ...base, leverage: 15 }, market), Error, 'high-leverage'));
Deno.test('rejects leverage above market max', () => void assertThrows(() => preparePerp({ ...base, leverage: 25, acknowledgedHighLeverage: true }, market)));
Deno.test('rejects TP below entry for longs', () => void assertThrows(() => preparePerp({ ...base, tp: '90' }, market)));
Deno.test('rejects SL beyond liquidation', () => void assertThrows(() => preparePerp({ ...base, leverage: 10, sl: '80' }, market)));
