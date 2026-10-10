import { assertEquals } from 'std/assert';
import { resolveThesis } from '@hopium/core/trading/thesis';

const base = {
  direction: 'long' as const,
  entryPrice: '100',
  targetPrice: '120',
  invalidationPrice: '90',
  timeframeEnd: new Date(Date.now() + 86_400_000).toISOString(),
  status: 'active' as const,
  maxFavorablePct: '0',
};

Deno.test('hit at target', () => assertEquals(resolveThesis(base, '121').status, 'hit'));
Deno.test('invalidated below invalidation', () =>
  assertEquals(resolveThesis(base, '85').status, 'invalidated'),
);
Deno.test('expired after timeframe', () =>
  assertEquals(
    resolveThesis({ ...base, timeframeEnd: new Date(0).toISOString() }, '105').status,
    'expired',
  ),
);
