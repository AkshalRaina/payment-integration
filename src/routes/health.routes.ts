import { Router } from 'express';
import { healthController } from '../controllers/health.controller';

const router = Router();

/**
 * Health check routes.
 *
 * GET /  → Service health status
 */
router.get('/', healthController.healthCheck.bind(healthController));

export { router as healthRoutes };
