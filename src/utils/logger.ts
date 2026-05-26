import winston from 'winston';
import { config } from '../config';

/**
 * Custom log format that includes timestamp, level, message,
 * and any additional metadata (correlation ID, payment ID, etc.).
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  config.NODE_ENV === 'development'
    ? winston.format.combine(winston.format.colorize(), winston.format.simple())
    : winston.format.json(),
);

/**
 * Winston logger instance.
 *
 * Usage:
 *   logger.info('Payment created', { paymentId, amount });
 *   logger.error('Gateway timeout', { paymentId, error });
 *   logger.warn('Retry scheduled', { paymentId, attempt, delay });
 */
const logger = winston.createLogger({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: {
    service: 'payment-system',
  },
  transports: [
    // Console transport (always active)
    new winston.transports.Console(),

    // File transports (production only)
    ...(config.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10,
          }),
        ]
      : []),
  ],
});

/**
 * Create a child logger with additional context metadata.
 * Useful for per-request or per-payment logging.
 *
 * @example
 * const paymentLogger = createChildLogger({ paymentId: 'abc-123', correlationId: 'req-456' });
 * paymentLogger.info('Processing payment');
 */
export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}

export { logger };
