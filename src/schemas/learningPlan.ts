import { z } from 'zod';

export const generatePlanSchema = z.object({
  targetCompanies: z.array(z.string()).max(5, 'Maximum of 5 target companies'),
  targetRole: z.string().min(1, 'Target role is required'),
  availableHoursPerWeek: z.number().int().min(1).max(40),
  interviewDate: z.string().optional().nullable()
});

export const toggleTaskSchema = z.object({
  weekNumber: z.number().int().min(1),
  dayOfWeek: z.string().min(1),
  taskIndex: z.number().int().min(0)
});

export const emptySchema = z.object({}).strict();

export const addTaskSchema = z.object({
  weekNumber: z.number().int().min(1),
  dayOfWeek: z.string().min(1),
  topic: z.string().min(1, 'Topic is required'),
  activityType: z.string().min(1, 'Activity type is required'),
  durationMinutes: z.number().int().min(1).max(300)
});

export const editTaskSchema = z.object({
  weekNumber: z.number().int().min(1),
  dayOfWeek: z.string().min(1),
  taskIndex: z.number().int().min(0),
  topic: z.string().min(1, 'Topic is required'),
  activityType: z.string().min(1, 'Activity type is required'),
  durationMinutes: z.number().int().min(1).max(300)
});

export const deleteTaskSchema = z.object({
  weekNumber: z.number().int().min(1),
  dayOfWeek: z.string().min(1),
  taskIndex: z.number().int().min(0)
});

