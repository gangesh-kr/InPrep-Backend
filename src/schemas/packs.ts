import { z } from 'zod';

export const packIdParamSchema = z.object({
  packId: z.string().uuid()
});
