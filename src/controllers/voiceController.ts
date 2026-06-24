import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import VoiceService from '../services/VoiceService';
import logger from '../utils/logger';
import ApiError from '../utils/ApiError';
import Redis from 'ioredis';

let redis: any = null;
/* Redis is disabled
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
    redis.on('error', (err) => {
      logger.warn({ error: err.message }, 'Redis client connection error in VoiceController - rate limiting might be degraded');
    });
  } catch (err) {
    logger.error(err, 'Failed to initialize Redis client in VoiceController');
  }
}
*/

export const transcribe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    // 1. Check Rate Limit (30 requests per user per hour)
    if (redis) {
      const redisKey = `voice_transcribe_limit:${userId}`;
      const requestCount = await redis.incr(redisKey);
      
      if (requestCount === 1) {
        // Set TTL of 1 hour (3600 seconds)
        await redis.expire(redisKey, 3600);
      }
      
      if (requestCount > 30) {
        return res.status(429).json({ error: 'Rate limit exceeded. You can only perform 30 transcribing actions per hour.' });
      }
    }

    // 2. Process file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    const transcription = await VoiceService.transcribeAudio(req.file.buffer, req.file.originalname);
    return res.json({ text: transcription });
  } catch (error: any) {
    logger.error({ event: 'transcribe_error', error: error.message }, 'Error in transcribe controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};

export const synthesize = async (req: AuthRequest, res: Response) => {
  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text to synthesize is required.' });
    }

    const audioBuffer = await VoiceService.synthesizeText(text, voice);
    
    // Stream audio buffer back to client
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    return res.send(audioBuffer);
  } catch (error: any) {
    logger.error({ event: 'synthesize_error', error: error.message }, 'Error in synthesize controller');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Internal server error.' });
  }
};
