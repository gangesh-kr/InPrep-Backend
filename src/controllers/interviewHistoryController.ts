import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import InterviewHistoryService from '../services/InterviewHistoryService';
import logger from '../utils/logger';

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    // Express query params are strings, validateRequest already transformed them or we parse them
    const { page, pageSize, interviewType, startDate, endDate, minScore, maxScore, search } = req.query as any;

    const result = await InterviewHistoryService.getHistory({
      userId,
      page,
      pageSize,
      interviewType,
      startDate,
      endDate,
      minScore,
      maxScore,
      search
    });

    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'get_history_list_error', error: error.message }, 'Error in getHistory controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const getInterviewDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;

    const details = await InterviewHistoryService.getHistoryDetails(userId, sessionId);
    return res.json(details);
  } catch (error: any) {
    logger.error({ event: 'get_history_details_error', error: error.message }, 'Error in getInterviewDetails controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const deleteHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;

    const result = await InterviewHistoryService.softDeleteHistory(userId, sessionId);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'delete_history_error', error: error.message }, 'Error in deleteHistory controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};
