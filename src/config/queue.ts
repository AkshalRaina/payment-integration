import { Queue, QueueOptions } from 'bullmq';
import { config } from './index';

/**
 * Shared BullMQ connection options.
 * All queues and workers use the same Redis connection config.
 */
export const queueConnectionOptions: QueueOptions['connection'] = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

/**
 * Queue name constants.
 */
export const QUEUE_NAMES = {
  PAYMENT_PROCESS: 'payment_process',
  PAYMENT_RETRY: 'payment_retry',
} as const;

/**
 * Payment processing queue.
 * Handles initial payment gateway submissions.
 */
export const paymentProcessQueue = new Queue(QUEUE_NAMES.PAYMENT_PROCESS, {
  connection: queueConnectionOptions,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
    removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs
    attempts: 1, // No automatic BullMQ retries — we handle retries ourselves
  },
});

/**
 * Payment retry queue.
 * Handles delayed retry jobs with exponential backoff.
 */
export const paymentRetryQueue = new Queue(QUEUE_NAMES.PAYMENT_RETRY, {
  connection: queueConnectionOptions,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 1,
  },
});

/**
 * Gracefully close all queues.
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([paymentProcessQueue.close(), paymentRetryQueue.close()]);
}

/**
 * Verify queue connectivity by checking the underlying Redis connection.
 */
export async function checkQueueHealth(): Promise<boolean> {
  try {
    // Check if the queue's Redis connection is alive
    /*
    That's why checking the queue's health and checking its
    Redis connection are effectively the same thing — if Redis dies,
    the queue dies too, because the queue lives inside Redis.
    */
    await paymentProcessQueue.client;
    return true;
  } catch {
    return false;
  }
}
