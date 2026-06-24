import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import CompanyPackService from '../services/CompanyPackService';
import logger from '../utils/logger';

export const listPacks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const packs = await CompanyPackService.getPacks(userId);
    return res.json(packs);
  } catch (error: any) {
    logger.error({ event: 'list_packs_error', error: error.message }, 'Error listing company packs');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const getPackDetail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { packId } = req.params;

    const detail = await CompanyPackService.getPackDetail(userId, packId);
    return res.json(detail);
  } catch (error: any) {
    logger.error({ event: 'get_pack_detail_error', error: error.message }, 'Error getting company pack details');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const startPackSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { packId } = req.params;

    const result = await CompanyPackService.startPackSession(userId, packId);
    return res.status(201).json(result);
  } catch (error: any) {
    logger.error({ event: 'start_pack_session_error', error: error.message }, 'Error starting company pack session');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const purchasePack = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { packId } = req.params;

    const result = await CompanyPackService.purchasePack(userId, packId);
    return res.json(result);
  } catch (error: any) {
    logger.error({ event: 'purchase_pack_error', error: error.message }, 'Error purchasing company pack');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};
