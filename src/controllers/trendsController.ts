import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AnalyticsService from '../services/AnalyticsService';
import logger from '../utils/logger';

export const getTrends = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { timeframe } = req.query as any;

    const result = await AnalyticsService.getTrends({ userId, timeframe });
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'get_trends_error', error: error.message }, 'Error in getTrends controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const getScoreBreakdown = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await AnalyticsService.getScoreBreakdown(userId);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'get_score_breakdown_error', error: error.message }, 'Error in getScoreBreakdown controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const getActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await AnalyticsService.getActivity(userId);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'get_activity_error', error: error.message }, 'Error in getActivity controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};
