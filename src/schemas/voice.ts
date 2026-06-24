import { z } from 'zod';

export const synthesizeBodySchema = z.object({
  text: z.string().min(1, 'Text to synthesize is required'),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional().default('alloy')
});

export const transcribeBodySchema = z.object({});
