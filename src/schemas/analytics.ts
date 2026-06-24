import { z } from 'zod';

export const getTrendsQuerySchema = z.object({
  timeframe: z.enum(['7d', '30d', '90d', 'all'])
});
