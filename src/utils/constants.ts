/**
 * Payment status constants — mirrors the Prisma PaymentStatus enum
 * but usable without importing the database client.
 */
export const PaymentStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  RETRY_SCHEDULED: 'RETRY_SCHEDULED',
  PERMANENTLY_FAILED: 'PERMANENTLY_FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/**
 * Terminal states — no further transitions allowed.
 */
export const TERMINAL_STATES: ReadonlySet<PaymentStatusType> = new Set([
  PaymentStatus.SUCCESS,
  PaymentStatus.PERMANENTLY_FAILED,
  PaymentStatus.CANCELLED,
]);

/**
 * Valid state transitions map.
 * Key = current state, Value = set of allowed next states.
 */
export const VALID_TRANSITIONS: Record<PaymentStatusType, ReadonlySet<PaymentStatusType>> = {
  [PaymentStatus.CREATED]: new Set([PaymentStatus.PENDING, PaymentStatus.CANCELLED]),
  [PaymentStatus.PENDING]: new Set([PaymentStatus.PROCESSING, PaymentStatus.CANCELLED]),
  [PaymentStatus.PROCESSING]: new Set([PaymentStatus.SUCCESS, PaymentStatus.FAILED]),
  [PaymentStatus.FAILED]: new Set([
    PaymentStatus.RETRY_SCHEDULED,
    PaymentStatus.PERMANENTLY_FAILED,
  ]),
  [PaymentStatus.RETRY_SCHEDULED]: new Set([PaymentStatus.PENDING]),
  [PaymentStatus.SUCCESS]: new Set(),
  [PaymentStatus.PERMANENTLY_FAILED]: new Set(),
  [PaymentStatus.CANCELLED]: new Set(),
};

/**
 * Gateway error codes.
 */
export const GatewayErrorCode = {
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  CARD_EXPIRED: 'CARD_EXPIRED',
  FRAUD_DETECTED: 'FRAUD_DETECTED',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type GatewayErrorCodeType = (typeof GatewayErrorCode)[keyof typeof GatewayErrorCode];

/**
 * Non-retryable error codes — these go straight to PERMANENTLY_FAILED.
 */
export const NON_RETRYABLE_ERRORS: ReadonlySet<GatewayErrorCodeType> = new Set([
  GatewayErrorCode.INSUFFICIENT_FUNDS,
  GatewayErrorCode.CARD_EXPIRED,
  GatewayErrorCode.FRAUD_DETECTED,
]);

/**
 * Retryable error codes.
 */
export const RETRYABLE_ERRORS: ReadonlySet<GatewayErrorCodeType> = new Set([
  GatewayErrorCode.GATEWAY_TIMEOUT,
  GatewayErrorCode.NETWORK_ERROR,
  GatewayErrorCode.INTERNAL_ERROR,
]);

/**
 * Payment event types for audit trail.
 */
export const EventType = {
  STATE_CHANGE: 'state_change',
  RETRY_SCHEDULED: 'retry_scheduled',
  WEBHOOK_RECEIVED: 'webhook_received',
  GATEWAY_REQUEST: 'gateway_request',
  GATEWAY_RESPONSE: 'gateway_response',
  LOCK_ACQUIRED: 'lock_acquired',
  LOCK_RELEASED: 'lock_released',
  ERROR: 'error',
} as const;

/**
 * Supported currencies (ISO 4217).
 */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Default configuration values (used as fallbacks).
 */
export const DEFAULTS = {
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,
  RETRY_MAX_DELAY_MS: 30000,
  LOCK_TTL_MS: 30000,
  IDEMPOTENCY_TTL_HOURS: 24,
  GATEWAY_TIMEOUT_MS: 10000,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
