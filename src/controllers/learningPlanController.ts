import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import LearningPlanService from '../services/LearningPlanService';
import logger from '../utils/logger';

export const generatePlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { targetCompanies, targetRole, availableHoursPerWeek, interviewDate } = req.body;

    const result = await LearningPlanService.generatePlan({
      userId,
      targetCompanies,
      targetRole,
      availableHoursPerWeek,
      interviewDate
    });

    return res.status(201).json(result);
  } catch (error: any) {
    logger.error({ event: 'generate_plan_error', error: error.message }, 'Error in generatePlan controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const getPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const plan = await LearningPlanService.getPlan(userId);
    return res.json(plan);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 404) {
      logger.info({ event: 'get_plan_not_found', userId: req.userId }, 'No active learning plan found');
    } else {
      logger.error({ event: 'get_plan_error', error: error.message }, 'Error in getPlan controller');
    }
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const toggleTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { weekNumber, dayOfWeek, taskIndex } = req.body;

    const result = await LearningPlanService.toggleTask({
      userId,
      weekNumber,
      dayOfWeek,
      taskIndex
    });

    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'toggle_task_error', error: error.message }, 'Error in toggleTask controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const regeneratePlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const result = await LearningPlanService.regeneratePlan(userId);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'regenerate_plan_error', error: error.message }, 'Error in regeneratePlan controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Internal server error.',
      code: error.code,
      details: error.details
    });
  }
};
