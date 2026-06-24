import { z } from 'zod';

export const getHistoryQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  pageSize: z.string().optional().transform(val => val ? Math.min(50, parseInt(val, 10)) : 10),
  interviewType: z.enum(['technical', 'behavioral', 'system design']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minScore: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  maxScore: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  search: z.string().optional()
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid()
});
