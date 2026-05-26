import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { CreatePaymentRequest, PaymentListFilters } from '../types';
import { DEFAULTS } from '../utils/constants';
import { StatusCodes } from 'http-status-codes';

/**
 * Payment controller — thin layer that parses requests,
 * delegates to the service, and formats responses.
 *
 * NO business logic lives here.
 */
export class PaymentController {
  /**
   * POST /api/v1/payments
   * Create a new payment.
   */
  async initiatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreatePaymentRequest = req.body;
      const rawKey = req.headers['idempotency-key'];
      const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

      const payment = await paymentService.createPayment(data, idempotencyKey);

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: payment,
        message: 'Payment created and queued for processing',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/:id
   * Get a single payment by ID with event history.
   */
  async getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const payment = await paymentService.getPayment(id);

      res.status(StatusCodes.OK).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments
   * List payments with pagination and filters.
   */
  async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: PaymentListFilters = {
        page: Math.max(1, parseInt(String(req.query.page || '1'))),
        limit: Math.min(
          DEFAULTS.MAX_PAGE_SIZE,
          Math.max(1, parseInt(String(req.query.limit || DEFAULTS.PAGE_SIZE))),
        ),
        status: req.query.status as PaymentListFilters['status'],
        merchantId: req.query.merchantId as string | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
      };

      const result = await paymentService.listPayments(filters);

      res.status(StatusCodes.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/:id/cancel
   * Cancel a pending payment.
   */
  async cancelPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const payment = await paymentService.cancelPayment(id);

      res.status(StatusCodes.OK).json({
        success: true,
        data: payment,
        message: 'Payment cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
