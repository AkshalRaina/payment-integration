import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database';
import { checkRedisHealth } from '../config/redis';
import { checkQueueHealth } from '../config/queue';
import { StatusCodes } from 'http-status-codes';

/**
 * Health check controller.
 * Verifies connectivity to all external dependencies.
 */
export class HealthController {
  /**
   * GET /api/v1/health
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    const [dbHealthy, redisHealthy, queueHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkQueueHealth(),
    ]);

    const allHealthy = dbHealthy && redisHealthy && queueHealthy;
    const status = allHealthy ? 'healthy' : dbHealthy ? 'degraded' : 'unhealthy';

    const statusCode = allHealthy
      ? StatusCodes.OK
      : dbHealthy
        ? StatusCodes.OK // Degraded but functional
        : StatusCodes.SERVICE_UNAVAILABLE;

    res.status(statusCode).json({
      success: true,
      data: {
        status,
        timestamp: new Date().toISOString(),
        services: {
          database: { status: dbHealthy ? 'up' : 'down' },
          redis: { status: redisHealthy ? 'up' : 'down' },
          queue: { status: queueHealthy ? 'up' : 'down' },
        },
        uptime: process.uptime(),
        memoryUsage: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        },
      },
    });
  }
}

export const healthController = new HealthController();
