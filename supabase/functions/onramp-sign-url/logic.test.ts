import { assertMatch } from 'std/assert';
import { signUrl } from './logic.ts';

Deno.test('appends a deterministic signature', async () => {
  const url = await signUrl(
    'https://buy.moonpay.com?apiKey=pk_test&currencyCode=usdc_sol',
    'secret',
  );
  assertMatch(url, /&signature=[A-Za-z0-9%]+$/);
});
