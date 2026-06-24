import { z } from 'zod';

export const generateScorecardSchema = z.object({
  sessionId: z.string().uuid()
});

export const scorecardIdParamSchema = z.object({
  scorecardId: z.string()
});

export const shareScorecardSchema = z.object({
  expiresAt: z.string().datetime().optional()
});

export const publicTokenParamSchema = z.object({
  publicToken: z.string().length(12)
});
