import { assertThrows } from 'std/assert';
import { z } from 'zod';

const schema = z.object({ userIds: z.array(z.string().uuid()).min(1), title: z.string().min(1) });

Deno.test('requires recipients and a title', () => {
  assertThrows(() => schema.parse({ userIds: [], title: 'x' }));
  assertThrows(() => schema.parse({ userIds: ['not-a-uuid'], title: 'x' }));
});
