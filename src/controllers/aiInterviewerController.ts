import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import InterviewService from '../services/InterviewService';
import logger from '../utils/logger';

// 1. Start Interview Session
export const startInterview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { position, companyName, jobDescription, personality, voiceEnabled, interviewType, packId } = req.body;

    if (!position || !jobDescription || !personality) {
      return res.status(400).json({ error: 'Position, Job Description, and Personality are required fields.' });
    }

    const result = await InterviewService.startInterview({
      userId,
      position,
      companyName,
      jobDescription,
      personality,
      resumeFileBuffer: req.file?.buffer,
      voiceEnabled: voiceEnabled === 'true' || voiceEnabled === true,
      interviewType,
      packId
    });

    logger.info({ event: 'start_interview_success', userId, interviewId: result.interviewId }, 'Started a new interview session');

    return res.status(201).json({
      message: 'Interview started successfully',
      ...result
    });
  } catch (error: any) {
    logger.error({ event: 'start_interview_error', error: error.message }, 'Error starting interview');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error starting interview.' });
  }
};

// 2. Respond to Current Question & Receive Next Question
export const respondInterview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { interviewId, answer } = req.body;

    if (!interviewId || answer === undefined) {
      return res.status(400).json({ error: 'Interview ID and Candidate Answer are required.' });
    }

    const result = await InterviewService.respondInterview({
      userId,
      interviewId,
      answer
    });

    logger.info({ event: 'respond_interview_success', userId, interviewId, isFinished: result.isFinished }, 'Processed interview answer');

    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'respond_interview_error', error: error.message }, 'Error processing interview response');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error processing response.' });
  }
};

// 3. Prematurely Finish and Evaluate Interview
export const finishInterview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { interviewId } = req.body;

    if (!interviewId) {
      return res.status(400).json({ error: 'Interview ID is required.' });
    }

    const result = await InterviewService.finishInterview({
      userId,
      interviewId
    });

    logger.info({ event: 'finish_interview_success', userId, interviewId }, 'Finished interview early');

    return res.json({
      message: 'Interview finished early and evaluated.',
      ...result
    });
  } catch (error: any) {
    logger.error({ event: 'finish_interview_error', error: error.message }, 'Error finishing interview early');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error finishing interview.' });
  }
};

// 4. Get History of Past AI Interviews
export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const history = await InterviewService.getHistory(userId);
    return res.json(history);
  } catch (error: any) {
    logger.error({ event: 'get_history_error', error: error.message }, 'Error fetching interview history');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error fetching history.' });
  }
};

// 5. Get Detailed Interview Report
export const getInterviewDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const details = await InterviewService.getInterviewDetails(userId, id);
    return res.json(details);
  } catch (error: any) {
    logger.error({ event: 'get_details_error', error: error.message }, 'Error fetching interview details');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error fetching details.' });
  }
};

// 6. Purchase Credits (Mock Purchase Integration - Disabled for security)
export const purchaseCredits = async (req: AuthRequest, res: Response) => {
  logger.info({ event: 'purchase_credits_attempt', userId: req.userId }, 'Attempted to purchase credits - disabled');
  return res.status(503).json({ error: 'Payment integration coming soon' });
};
