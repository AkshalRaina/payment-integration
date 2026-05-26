import { app } from './app';
import { config } from './config';
import { redis } from './config/redis';
import { disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';
import { closeQueues } from './config/queue';
import { startWorkers, stopWorkers } from './queue/payment.worker';
import { logger } from './utils/logger';

/**
 * Server entry point.
 *
 * 1. Connects to Redis
 * 2. Starts BullMQ workers
 * 3. Starts HTTP server
 * 4. Registers graceful shutdown handlers
 */
async function bootstrap(): Promise<void> {
  try {
    // Connect Redis (lazy connect mode)
    await redis.connect();
    logger.info('Redis connected');

    // Start queue workers
    startWorkers();
    logger.info('Queue workers started');

    // Start HTTP server
    const server = app.listen(config.PORT, () => {
      logger.info(`🚀 Payment Processing System running on port ${config.PORT}`, {
        environment: config.NODE_ENV,
        port: config.PORT,
      });
    });

    // ─── Graceful Shutdown ───
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — starting graceful shutdown`);

      // 1. Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // 2. Stop queue workers (wait for in-flight jobs)
      try {
        await stopWorkers();
        logger.info('Queue workers stopped');
      } catch (err) {
        logger.error('Error stopping workers', { error: err });
      }

      // 3. Close queues
      try {
        await closeQueues();
        logger.info('Queues closed');
      } catch (err) {
        logger.error('Error closing queues', { error: err });
      }

      // 4. Disconnect Redis
      try {
        await disconnectRedis();
        logger.info('Redis disconnected');
      } catch (err) {
        logger.error('Error disconnecting Redis', { error: err });
      }

      // 5. Disconnect database
      try {
        await disconnectDatabase();
        logger.info('Database disconnected');
      } catch (err) {
        logger.error('Error disconnecting database', { error: err });
      }

      logger.info('Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

bootstrap();
