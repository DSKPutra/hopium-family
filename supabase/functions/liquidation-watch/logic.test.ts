import { assertEquals } from 'std/assert';
import { isNearLiquidation } from '@hopium/core/trading/perps';

Deno.test('warns within 10% of liquidation', () => {
  assertEquals(isNearLiquidation('long', '100', '92'), true);
  assertEquals(isNearLiquidation('long', '100', '70'), false);
  assertEquals(isNearLiquidation('short', '100', '108'), true);
});
