import { GatewayErrorCodeType } from '../utils/constants';

/**
 * Request sent to the external gateway.
 */
export interface GatewayPaymentRequest {
  paymentId: string;
  amount: number;
  currency: string;
  merchantId: string;
  customerEmail: string;
  description?: string;
}

/**
 * Response from the external gateway.
 */
export interface GatewayPaymentResponse {
  /** Whether the payment was successful */
  success: boolean;
  /** Gateway's internal transaction reference */
  gatewayReference: string;
  /** Status returned by gateway */
  status: 'success' | 'failed' | 'pending';
  /** Error code if failed */
  errorCode?: GatewayErrorCodeType;
  /** Human-readable error message */
  errorMessage?: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Configuration for the gateway simulator's probability distribution.
 */
export interface GatewaySimulatorConfig {
  /** Probability of instant success (0-1) */
  instantSuccessRate: number;
  /** Probability of delayed success (0-1) */
  delayedSuccessRate: number;
  /** Probability of instant failure (0-1) */
  instantFailureRate: number;
  /** Probability of timeout (0-1) */
  timeoutRate: number;
  /** Probability of network error (0-1) */
  networkErrorRate: number;
  /** Probability of pending + webhook callback (0-1) */
  webhookOnlyRate: number;
  /** Minimum delay for delayed responses in ms */
  minDelayMs: number;
  /** Maximum delay for delayed responses in ms */
  maxDelayMs: number;
  /** Timeout duration in ms */
  timeoutMs: number;
}
