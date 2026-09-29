import { assertEquals } from 'std/assert';
import { alertTriggered } from './logic.ts';

Deno.test('above / below / pct change', () => {
  assertEquals(alertTriggered('above', '100', '90', '101'), true);
  assertEquals(alertTriggered('below', '100', '110', '101'), false);
  assertEquals(alertTriggered('pct_change', '10', '100', '89'), true);
  assertEquals(alertTriggered('pct_change', '10', '100', '95'), false);
});
