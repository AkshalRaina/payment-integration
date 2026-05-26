import { Request, Response } from 'express';
import { PaymentStatusType, SupportedCurrency, GatewayErrorCodeType } from '../utils/constants';

// ─── Payment Types ───

/**
 * Request body for creating a new payment.
 */
export interface CreatePaymentRequest {
  amount: number;
  currency: SupportedCurrency;
  merchantId: string;
  customerEmail: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Payment response returned to the client.
 */
export interface PaymentResponse {
  id: string;
  amount: string;
  currency: string;
  status: PaymentStatusType;
  merchantId: string;
  customerEmail: string;
  description: string | null;
  gatewayReference: string | null;
  retryCount: number;
  maxRetries: number;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payment with its event history.
 */
export interface PaymentWithEvents extends PaymentResponse {
  events: PaymentEventResponse[];
}

/**
 * Payment event response.
 */
export interface PaymentEventResponse {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  eventType: string;
  eventData: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Pagination ───

/**
 * Pagination query parameters.
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Payment list filter parameters.
 */
export interface PaymentListFilters extends PaginationParams {
  status?: PaymentStatusType;
  merchantId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ─── Gateway Types ───

/**
 * Gateway processing result.
 */
export interface GatewayResult {
  success: boolean;
  gatewayReference?: string;
  errorCode?: GatewayErrorCodeType;
  errorMessage?: string;
  /** If true, the result will arrive via webhook instead */
  pendingWebhook?: boolean;
}

// ─── Webhook Types ───

/**
 * Incoming webhook payload from the gateway.
 */
export interface WebhookPayload {
  eventId: string;
  paymentId: string;
  status: 'success' | 'failed';
  gatewayReference: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}

// ─── API Response Types ───

/**
 * Standard API success response.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard API error response.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ─── Express Extensions ───

/**
 * Express request with typed body.
 */
export interface TypedRequest<T> extends Request {
  body: T;
}

/**
 * Express response with typed JSON.
 */
export type TypedResponse<T> = Response<ApiSuccessResponse<T> | ApiErrorResponse>;
