import { paymentProcessQueue, paymentRetryQueue } from '../config/queue';
import { logger } from '../utils/logger';

/**
 * Payment job producer.
 * Enqueues jobs for the payment processing and retry workers.
 */
export class PaymentProducer {
  /**
   * Enqueue a payment for initial processing.
   */
  async enqueuePayment(paymentId: string): Promise<void> {
    await paymentProcessQueue.add(
      'process-payment',
      { paymentId },
      {
        jobId: `process_${paymentId}`, // Prevent duplicate jobs for the same payment
      },
    );

    logger.info('Payment enqueued for processing', { paymentId });
  }

  /**
   * Enqueue a payment retry with a calculated delay.
   *
   * @param paymentId - Payment to retry
   * @param attempt - Current attempt number (for logging)
   * @param delayMs - Backoff delay in milliseconds
   */
  async enqueueRetry(paymentId: string, attempt: number, delayMs: number): Promise<void> {
    await paymentRetryQueue.add(
      'retry-payment',
      { paymentId, attempt },
      {
        jobId: `retry_${paymentId}_${attempt}`,
        delay: delayMs,
      },
    );

    logger.info('Payment retry enqueued', { paymentId, attempt, delayMs });
  }
}

export const paymentProducer = new PaymentProducer();
