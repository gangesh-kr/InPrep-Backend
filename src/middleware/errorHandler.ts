import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // 2. Structured ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // 3. General/Uncaught Error
  logger.error(
    {
      event: 'uncaught_server_error',
      method: req.method,
      url: req.url,
      error: err.message || err,
      stack: err.stack,
    },
    'Uncaught server error handled globally'
  );

  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error. Please try again later.',
  });
};

export default errorHandler;
