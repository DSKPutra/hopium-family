import { z } from 'zod';

export const deleteSchema = z.object({
  confirmation: z
    .string()
    .refine((v) => v.trim().toLowerCase() === 'delete', 'Type "delete" to confirm.'),
});
