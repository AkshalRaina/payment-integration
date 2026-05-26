import { logger } from './logger';
import { CircuitBreakerOpenError } from './errors';

/**
 * Circuit breaker states.
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation — requests pass through
  OPEN = 'OPEN', // Failures exceeded threshold — requests are rejected
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered — limited requests allowed
}

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerOptions {
  /** Number of recent requests to track in the sliding window */
  windowSize: number;
  /** Failure rate threshold (0-1) to trip the circuit */
  failureThreshold: number;
  /** Duration in ms to stay in OPEN state before moving to HALF_OPEN */
  resetTimeout: number;
  /** Number of consecutive successes in HALF_OPEN to close the circuit */
  halfOpenSuccessThreshold: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  windowSize: 10,
  failureThreshold: 0.5,
  resetTimeout: 30000,
  halfOpenSuccessThreshold: 3,
};

/**
 * Circuit Breaker pattern implementation.
 *
 * Protects against cascading failures when the external payment gateway
 * is unhealthy. Tracks success/failure rates over a sliding window and
 * trips open when failures exceed the threshold.
 *
 * States:
 * - CLOSED: Requests pass through normally. Failures are tracked.
 * - OPEN: All requests are rejected immediately. After resetTimeout, moves to HALF_OPEN.
 * - HALF_OPEN: A limited number of requests are allowed. If they succeed, circuit closes.
 *              If they fail, circuit re-opens.
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private readonly options: CircuitBreakerOptions;
  private results: boolean[] = []; // true = success, false = failure
  private halfOpenSuccesses: number = 0;
  private lastFailureTime: number = 0;
  private readonly name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @throws CircuitBreakerOpenError if the circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        logger.warn('Circuit breaker OPEN — rejecting request', {
          circuitBreaker: this.name,
          state: this.state,
          lastFailure: new Date(this.lastFailureTime).toISOString(),
        });
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' is open — service temporarily unavailable`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a success.
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      logger.debug('Circuit breaker HALF_OPEN success', {
        circuitBreaker: this.name,
        consecutiveSuccesses: this.halfOpenSuccesses,
        threshold: this.options.halfOpenSuccessThreshold,
      });

      if (this.halfOpenSuccesses >= this.options.halfOpenSuccessThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else {
      this.recordResult(true);
    }
  }

  /**
   * Record a failure.
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN immediately re-opens the circuit
      this.transitionTo(CircuitState.OPEN);
    } else {
      this.recordResult(false);
      this.checkThreshold();
    }
  }

  /**
   * Add a result to the sliding window.
   */
  private recordResult(success: boolean): void {
    this.results.push(success);
    if (this.results.length > this.options.windowSize) {
      this.results.shift();
    }
  }

  /**
   * Check if failure rate exceeds threshold.
   */
  private checkThreshold(): void {
    if (this.results.length < this.options.windowSize) {
      return; // Not enough data to make a decision
    }

    const failures = this.results.filter((r) => !r).length;
    const failureRate = failures / this.results.length;

    if (failureRate >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Transition to a new state.
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    logger.info('Circuit breaker state transition', {
      circuitBreaker: this.name,
      from: previousState,
      to: newState,
    });

    if (newState === CircuitState.CLOSED) {
      this.results = [];
      this.halfOpenSuccesses = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses = 0;
    }
  }

  /**
   * Get current circuit breaker state (for health checks / debugging).
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure rate.
   */
  getFailureRate(): number {
    if (this.results.length === 0) return 0;
    const failures = this.results.filter((r) => !r).length;
    return failures / this.results.length;
  }

  /**
   * Get circuit breaker stats.
   */
  getStats(): {
    name: string;
    state: CircuitState;
    failureRate: number;
    windowSize: number;
    totalTracked: number;
  } {
    return {
      name: this.name,
      state: this.state,
      failureRate: this.getFailureRate(),
      windowSize: this.options.windowSize,
      totalTracked: this.results.length,
    };
  }

  /**
   * Reset the circuit breaker to CLOSED state (for testing).
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.results = [];
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = 0;
  }
}
