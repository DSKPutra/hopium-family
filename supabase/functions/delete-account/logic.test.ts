import { assertThrows } from 'std/assert';
import { deleteSchema } from './logic.ts';

Deno.test('requires typed confirmation', () => {
  deleteSchema.parse({ confirmation: ' DELETE ' });
  assertThrows(() => deleteSchema.parse({ confirmation: 'yes' }));
});
