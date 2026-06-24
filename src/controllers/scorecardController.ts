import { Response, Request } from 'express';
import { AuthRequest } from '../middleware/auth';
import ScorecardService from '../services/ScorecardService';
import logger from '../utils/logger';

export const generateScorecard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.body;

    const result = await ScorecardService.generateScorecard(userId, sessionId);
    return res.status(201).json(result);
  } catch (error: any) {
    logger.error({ event: 'generate_scorecard_error', error: error.message }, 'Error in generateScorecard controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const shareScorecard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { scorecardId } = req.params;
    const { expiresAt } = req.body;

    const result = await ScorecardService.shareScorecard(userId, scorecardId, expiresAt);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'share_scorecard_error', error: error.message }, 'Error in shareScorecard controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const getPublicScorecard = async (req: Request, res: Response) => {
  try {
    const { publicToken } = req.params;

    const result = await ScorecardService.getPublicScorecard(publicToken);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'get_public_scorecard_error', token: req.params.publicToken, error: error.message }, 'Error fetching public scorecard');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const revokeScorecard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { scorecardId } = req.params;

    const result = await ScorecardService.revokeScorecard(userId, scorecardId);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'revoke_scorecard_error', error: error.message }, 'Error in revokeScorecard controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const deleteScorecard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { scorecardId } = req.params;

    const result = await ScorecardService.deleteScorecard(userId, scorecardId);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'delete_scorecard_error', error: error.message }, 'Error in deleteScorecard controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};
