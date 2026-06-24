import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import WeaknessAnalysisService from '../services/WeaknessAnalysisService';
import logger from '../utils/logger';

export const getWeaknessProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const profile = await WeaknessAnalysisService.getProfile(userId);
    return res.json(profile);
  } catch (error: any) {
    logger.error({ event: 'get_weakness_profile_error', error: error.message }, 'Error in getWeaknessProfile controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const refreshWeaknessProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const profile = await WeaknessAnalysisService.refreshProfile(userId);
    return res.json(profile);
  } catch (error: any) {
    logger.error({ event: 'refresh_weakness_profile_error', error: error.message }, 'Error in refreshWeaknessProfile controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Internal server error.',
      code: error.code,
      details: error.details
    });
  }
};
