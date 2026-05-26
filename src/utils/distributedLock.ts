import { redis } from '../config/redis';
import { logger } from './logger';
import { LockAcquisitionError } from './errors';
import { generateId } from './helpers';

/**
 * Redis-based distributed lock implementation.
 *
 * Uses SET NX EX for atomic lock acquisition and a Lua script
 * for safe release (compare-and-delete to prevent releasing
 * someone else's lock).
 */

/**
 * Lua script for safe lock release.
 * Only releases the lock if the stored token matches the provided token.
 * This prevents a client from releasing a lock it doesn't own.
 */
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * Acquire a distributed lock.
 *
 * @param key - Lock key (e.g., `payment:lock:{paymentId}`)
 * @param ttlMs - Lock time-to-live in milliseconds
 * @returns Lock token if acquired, null if lock already held
 */
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  const token = generateId();
  const ttlSeconds = Math.ceil(ttlMs / 1000);

  const result = await redis.set(key, token, 'EX', ttlSeconds, 'NX');

  if (result === 'OK') {
    logger.debug('Lock acquired', { key, token, ttlMs });
    return token;
  }

  logger.debug('Lock acquisition failed — already held', { key });
  return null;
}

/**
 * Release a distributed lock.
 * Uses a Lua script to ensure only the lock holder can release it.
 *
 * @param key - Lock key
 * @param token - Token returned from acquireLock
 * @returns true if lock was released, false if token didn't match
 */
export async function releaseLock(key: string, token: string): Promise<boolean> {
  const result = await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);

  const released = result === 1;
  if (released) {
    logger.debug('Lock released', { key, token });
  } else {
    logger.warn('Lock release failed — token mismatch or expired', { key, token });
  }

  return released;
}

/**
 * Execute a function while holding a distributed lock.
 * Acquires the lock, runs the function, and releases the lock regardless of outcome.
 *
 * @param key - Lock key
 * @param ttlMs - Lock time-to-live in milliseconds
 * @param fn - Async function to execute while holding the lock
 * @returns Result of the function
 * @throws LockAcquisitionError if the lock cannot be acquired
 */
export async function withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const token = await acquireLock(key, ttlMs);

  if (!token) {
    throw new LockAcquisitionError(key);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(key, token);
  }
}

/**
 * Generate a lock key for a payment.
 */
export function paymentLockKey(paymentId: string): string {
  return `payment:lock:${paymentId}`;
}
