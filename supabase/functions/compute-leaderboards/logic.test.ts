import { assertEquals } from 'std/assert';
import type { Trade } from '@hopium/core/types';
import { computeBoard } from './logic.ts';

const t = (userId: string, side: 'buy' | 'sell', realizedPnl: string, minute: number): Trade => ({
  id: `${userId}${minute}${side}`, userId, orderId: 'o', assetId: 'hope', symbol: 'HOPE', assetClass: 'crypto', side, qty: '1', price: '10',
  notional: '100', fee: '0', realizedPnl, isPublic: true, copiedFromTradeId: null, copiers: 1, createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
});

Deno.test('excludes wash traders from the PnL board', () => {
  const honest = Array.from({ length: 6 }, (_, i) => t('honest', i % 2 ? 'sell' : 'buy', i % 2 ? '20' : '0', i * 90));
  const wash = Array.from({ length: 24 }, (_, i) => t('wash', i % 2 ? 'sell' : 'buy', '0', i));
  const board = computeBoard('pnl_pct', new Map([['honest', honest], ['wash', wash]]), new Map());
  assertEquals(board.map((r) => r.userId), ['honest']);
});

Deno.test('ranks copiers with ties', () => {
  const board = computeBoard('copiers', new Map([['a', [t('a', 'buy', '0', 1)]], ['b', [t('b', 'buy', '0', 1)]]]), new Map());
  assertEquals(board.map((r) => r.rank), [1, 1]);
});
