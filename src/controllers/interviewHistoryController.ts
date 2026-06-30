import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import InterviewHistoryService from '../services/InterviewHistoryService';
import asyncHandler from '../utils/asyncHandler';

export const getHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
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
});

export const getInterviewDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { sessionId } = req.params;

  const details = await InterviewHistoryService.getHistoryDetails(userId, sessionId);
  return res.json(details);
});

export const deleteHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { sessionId } = req.params;

  const result = await InterviewHistoryService.softDeleteHistory(userId, sessionId);
  return res.json(result);
});
