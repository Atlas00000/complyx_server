/**
 * Request logging middleware
 * Logs all HTTP requests with timing, status codes, and context
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { logger } from '../utils/logger';

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return randomBytes(16).toString('hex');
}

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Request logging middleware
 * Logs request details and response timing
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  const requestId = generateRequestId();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Get user ID from request if available
  const userId = (req as any).user?.id || (req as any).userId;

  // Log request
  logger.request(
    req.method,
    req.originalUrl || req.url,
    requestId,
    req.ip || req.socket.remoteAddress,
    userId,
    {
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
        'accept': req.get('accept'),
      },
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      body: req.method !== 'GET' && Object.keys(req.body || {}).length > 0 
        ? { ...req.body, password: undefined, token: undefined } // Remove sensitive data
        : undefined,
    }
  );

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk?: unknown, encoding?: unknown): Response {
    const duration = req.startTime ? Date.now() - req.startTime : 0;

    // Log response
    logger.response(
      req.method,
      req.originalUrl || req.url,
      res.statusCode,
      duration,
      requestId,
      {
        userId,
        ip: req.ip || req.socket.remoteAddress,
      }
    );

    // Call original end
    return originalEnd.call(this, chunk, encoding as BufferEncoding);
  };

  next();
};
