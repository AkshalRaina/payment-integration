import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../utils/constants';

/**
 * Zod schemas for request validation.
 */

/**
 * Create payment request body schema.
 */
export const createPaymentSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be positive')
    .max(999999999999.99, 'Amount exceeds maximum limit'),
  currency: z
    .string({ required_error: 'Currency is required' })
    .length(3, 'Currency must be a 3-letter ISO 4217 code')
    .toUpperCase()
    .refine(
      (val) => (SUPPORTED_CURRENCIES as readonly string[]).includes(val),
      `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
    ),
  merchantId: z
    .string({ required_error: 'Merchant ID is required' })
    .min(1, 'Merchant ID cannot be empty')
    .max(64, 'Merchant ID too long'),
  customerEmail: z
    .string({ required_error: 'Customer email is required' })
    .email('Invalid email format')
    .max(255, 'Email too long'),
  description: z.string().max(500, 'Description too long').optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Webhook payload schema.
 */
export const webhookPayloadSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  paymentId: z.string().uuid('Invalid payment ID format'),
  status: z.enum(['success', 'failed']),
  gatewayReference: z.string().min(1, 'Gateway reference is required'),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  timestamp: z.string().datetime('Invalid timestamp format'),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type WebhookPayloadInput = z.infer<typeof webhookPayloadSchema>;
