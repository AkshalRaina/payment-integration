import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, queueConnectionOptions } from '../config/queue';
import { config } from '../config';
import { paymentService } from '../services/payment.service';
import { retryService } from '../services/retry.service';
import { logger } from '../utils/logger';

/**
 * Payment processing worker.
 * Picks up jobs from the process queue and calls paymentService.processPayment().
 */
let processWorker: Worker | null = null;

/**
 * Payment retry worker.
 * Picks up delayed retry jobs and re-enqueues them for processing.
 */
let retryWorker: Worker | null = null;

/**
 * Start the payment processing worker.
 */
export function startProcessWorker(): Worker {
  processWorker = new Worker(
    QUEUE_NAMES.PAYMENT_PROCESS,
    async (job: Job<{ paymentId: string }>) => {
      const { paymentId } = job.data;
      const log = logger.child({ paymentId, jobId: job.id, queue: 'process' });

      log.info('Process worker: starting job');

      try {
        await paymentService.processPayment(paymentId);
        log.info('Process worker: job completed successfully');
      } catch (error) {
        log.error('Process worker: job failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Check if we should schedule a retry
        try {
          await retryService.handleFailedProcessing(paymentId);
        } catch (retryError) {
          log.error('Process worker: retry scheduling failed', {
            error: retryError instanceof Error ? retryError.message : 'Unknown error',
          });
        }

        throw error; // Let BullMQ know the job failed
      }
    },
    {
      connection: queueConnectionOptions,
      concurrency: config.QUEUE_CONCURRENCY,
    },
  );

  processWorker.on('completed', (job) => {
    logger.debug('Process worker: job completed', { jobId: job.id });
  });

  processWorker.on('failed', (job, err) => {
    logger.error('Process worker: job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  processWorker.on('error', (err) => {
    logger.error('Process worker: worker error', { error: err.message });
  });

  logger.info('Process worker started', {
    queue: QUEUE_NAMES.PAYMENT_PROCESS,
    concurrency: config.QUEUE_CONCURRENCY,
  });

  return processWorker;
}

/**
 * Start the payment retry worker.
 */
export function startRetryWorker(): Worker {
  retryWorker = new Worker(
    QUEUE_NAMES.PAYMENT_RETRY,
    async (job: Job<{ paymentId: string; attempt: number }>) => {
      const { paymentId, attempt } = job.data;
      const log = logger.child({ paymentId, jobId: job.id, queue: 'retry', attempt });

      log.info('Retry worker: processing retry');

      try {
        await retryService.executeRetry(paymentId);
        log.info('Retry worker: retry re-enqueued for processing');
      } catch (error) {
        log.error('Retry worker: retry failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    {
      connection: queueConnectionOptions,
      concurrency: config.QUEUE_CONCURRENCY,
    },
  );

  retryWorker.on('completed', (job) => {
    logger.debug('Retry worker: job completed', { jobId: job.id });
  });

  retryWorker.on('failed', (job, err) => {
    logger.error('Retry worker: job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  retryWorker.on('error', (err) => {
    logger.error('Retry worker: worker error', { error: err.message });
  });

  logger.info('Retry worker started', {
    queue: QUEUE_NAMES.PAYMENT_RETRY,
    concurrency: config.QUEUE_CONCURRENCY,
  });

  return retryWorker;
}

/**
 * Start all workers.
 */
export function startWorkers(): { processWorker: Worker; retryWorker: Worker } {
  return {
    processWorker: startProcessWorker(),
    retryWorker: startRetryWorker(),
  };
}

/**
 * Gracefully stop all workers.
 */
export async function stopWorkers(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (processWorker) {
    promises.push(processWorker.close());
  }
  if (retryWorker) {
    promises.push(retryWorker.close());
  }

  await Promise.all(promises);
  logger.info('All workers stopped');
}
