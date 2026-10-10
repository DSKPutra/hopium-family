import { assertThrows } from 'std/assert';
import { assertTpSl } from '@hopium/core/trading/perps';

Deno.test(
  'long TP must be above entry',
  () =>
    void assertThrows(() => assertTpSl({ side: 'long', entry: '100', liqPrice: '90', tp: '95' })),
);
Deno.test('short SL must be above entry and before liquidation', () => {
  assertTpSl({ side: 'short', entry: '100', liqPrice: '110', sl: '105' });
  assertThrows(() => assertTpSl({ side: 'short', entry: '100', liqPrice: '110', sl: '115' }));
});
