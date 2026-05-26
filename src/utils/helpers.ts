import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  PaymentStatusType,
  VALID_TRANSITIONS,
  RETRYABLE_ERRORS,
  GatewayErrorCodeType,
} from './constants';
import { config } from '../config';

/**
 * Generate a new UUID v4.
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Compute SHA-256 hash of a request body for idempotency comparison.
 */
export function hashBody(body: unknown): string {
  const normalized = JSON.stringify(body, Object.keys(body as object).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Check if a state transition is valid according to the state machine.
 */
export function isValidStateTransition(
  fromStatus: PaymentStatusType,
  toStatus: PaymentStatusType,
): boolean {
  const allowed = VALID_TRANSITIONS[fromStatus];
  return allowed ? allowed.has(toStatus) : false;
}

/**
 * Check if a gateway error code is retryable.
 */
export function isRetryableError(errorCode: string): boolean {
  return RETRYABLE_ERRORS.has(errorCode as GatewayErrorCodeType);
}

/**
 * Calculate exponential backoff delay with jitter.
 *
 * Formula: min(baseDelay * 2^attempt + random_jitter, maxDelay)
 *
 * @param attempt - Current retry attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default from config)
 * @param maxDelay - Maximum delay cap in milliseconds (default from config)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = config.RETRY_BASE_DELAY_MS,
  maxDelay: number = config.RETRY_MAX_DELAY_MS,
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay; // Random jitter up to baseDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Generate HMAC-SHA256 signature for webhook payloads.
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

/**
 * Verify HMAC-SHA256 webhook signature.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = generateWebhookSignature(payload, secret);

  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Format a payment amount for display (e.g., "1,234.56").
 */
export function formatAmount(amount: number | string, currency: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num);
}

/**
 * Sleep for a given number of milliseconds.
 * Useful for testing and simulating delays.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON, returning null on failure.
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
