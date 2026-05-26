import { Router } from 'express';
import { paymentRoutes } from './payment.routes';
import { webhookRoutes } from './webhook.routes';
import { healthRoutes } from './health.routes';

const router = Router();

/**
 * API v1 route aggregator.
 * Mounts all route modules under their respective paths.
 *
 * /api/v1/payments  → Payment operations
 * /api/v1/webhooks  → Webhook callbacks
 * /api/v1/health    → Health check
 */
router.use('/payments', paymentRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/health', healthRoutes);

export { router as apiRoutes };
