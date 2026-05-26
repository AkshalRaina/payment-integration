import { Request, Response, NextFunction } from 'express';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Request logger middleware.
 *
 * - Assigns a correlation ID (from X-Request-Id header or auto-generated)
 * - Logs request start (method, path, IP)
 * - Logs response completion (status, duration)
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Assign or use existing correlation ID
  const correlationId = (req.headers['x-request-id'] as string) || generateId();
  req.headers['x-request-id'] = correlationId;
  res.setHeader('X-Request-Id', correlationId);

  const startTime = Date.now();

  // Log request start
  logger.info('Request started', {
    correlationId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  // Log response completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const logData = {
      correlationId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}
