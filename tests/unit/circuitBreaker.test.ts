import { CircuitBreaker, CircuitState } from '../../src/utils/circuitBreaker';
import { CircuitBreakerOpenError } from '../../src/utils/errors';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    // Reset circuit breaker with small limits for easy testing
    cb = new CircuitBreaker('test-cb', {
      windowSize: 4,
      failureThreshold: 0.5,
      resetTimeout: 100, // 100ms
      halfOpenSuccessThreshold: 2,
    });
  });

  it('should start in CLOSED state and allow requests', async () => {
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
  });

  it('should open after failures exceed threshold', async () => {
    // 4 requests, 2 failures = 50% failure rate -> should trip. Order matters (last must fail to check threshold).
    await cb.execute(async () => 'success');
    await cb.execute(async () => 'success');
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');

    // Circuit should now be OPEN
    expect(cb.getState()).toBe(CircuitState.OPEN);

    // Further requests should throw CircuitBreakerOpenError
    await expect(cb.execute(async () => 'success')).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('should transition to HALF_OPEN after timeout and close on success', async () => {
    // Force OPEN
    await cb.execute(async () => 'success');
    await cb.execute(async () => 'success');
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    
    expect(cb.getState()).toBe(CircuitState.OPEN);

    // Wait for timeout (100ms)
    await new Promise(resolve => setTimeout(resolve, 150));

    // Next request should transition to HALF_OPEN and execute
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

    // Second success should close it (threshold is 2)
    await cb.execute(async () => 'success');
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('should re-open if a request fails in HALF_OPEN', async () => {
    // Force OPEN
    await cb.execute(async () => 'success');
    await cb.execute(async () => 'success');
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Fail in HALF_OPEN
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');

    // Should immediately go back to OPEN
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });
});
