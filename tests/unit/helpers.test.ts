import {
  generateId,
  calculateBackoffDelay,
  isValidStateTransition,
  isRetryableError,
  hashBody,
  verifyWebhookSignature,
} from '../../src/utils/helpers';
import { PaymentStatus } from '../../src/utils/constants';

describe('Helpers', () => {
  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff with jitter', () => {
      const delay0 = calculateBackoffDelay(0);
      const delay1 = calculateBackoffDelay(1);
      const delay2 = calculateBackoffDelay(2);

      // Base is 1000ms. attempt 0: ~1000, attempt 1: ~2000, attempt 2: ~4000
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThanOrEqual(2000);
      
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThanOrEqual(3000);

      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThanOrEqual(5000);
    });

    it('should cap at the maximum delay', () => {
      const delay = calculateBackoffDelay(10);
      expect(delay).toBeLessThanOrEqual(30000 + 15000); // 30s max + 50% max jitter
    });
  });

  describe('isValidStateTransition', () => {
    it('should allow valid transitions', () => {
      expect(isValidStateTransition(PaymentStatus.CREATED, PaymentStatus.PENDING)).toBe(true);
      expect(isValidStateTransition(PaymentStatus.PENDING, PaymentStatus.PROCESSING)).toBe(true);
      expect(isValidStateTransition(PaymentStatus.PROCESSING, PaymentStatus.SUCCESS)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(isValidStateTransition(PaymentStatus.SUCCESS, PaymentStatus.PENDING)).toBe(false);
      expect(isValidStateTransition(PaymentStatus.FAILED, PaymentStatus.SUCCESS)).toBe(false);
    });

    it('should reject transitions from terminal states', () => {
      expect(isValidStateTransition(PaymentStatus.SUCCESS, PaymentStatus.FAILED)).toBe(false);
      expect(isValidStateTransition(PaymentStatus.CANCELLED, PaymentStatus.PENDING)).toBe(false);
      expect(isValidStateTransition(PaymentStatus.PERMANENTLY_FAILED, PaymentStatus.RETRY_SCHEDULED)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable gateway errors', () => {
      expect(isRetryableError('GATEWAY_TIMEOUT')).toBe(true);
      expect(isRetryableError('NETWORK_ERROR')).toBe(true);
      expect(isRetryableError('INTERNAL_ERROR')).toBe(true);
    });

    it('should return false for permanent gateway errors', () => {
      expect(isRetryableError('INSUFFICIENT_FUNDS')).toBe(false);
      expect(isRetryableError('CARD_EXPIRED')).toBe(false);
      expect(isRetryableError('FRAUD_DETECTED')).toBe(false);
    });
  });

  describe('hashBody', () => {
    it('should generate a consistent SHA-256 hash', () => {
      const body = { amount: 100, currency: 'USD' };
      const hash1 = hashBody(body);
      const hash2 = hashBody({ amount: 100, currency: 'USD' });
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // hex encoded sha256
    });

    it('should be order-independent for JSON keys', () => {
      const hash1 = hashBody({ a: 1, b: 2 });
      const hash2 = hashBody({ b: 2, a: 1 });
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify a valid signature', () => {
      const payload = '{"status":"success"}';
      const secret = 'my-secret';
      
      // Calculate valid signature manually
      const crypto = require('crypto');
      const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
      
      expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject an invalid signature', () => {
      expect(verifyWebhookSignature('{"status":"success"}', 'invalid-sig', 'secret')).toBe(false);
    });
  });
});
