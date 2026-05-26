import { GatewaySimulator } from '../../src/gateway/gateway.simulator';
import { GatewayError } from '../../src/utils/errors';

describe('GatewaySimulator', () => {
  it('should return instant success based on configuration', async () => {
    // 100% instant success
    const gateway = new GatewaySimulator({
      instantSuccessRate: 1.0,
      delayedSuccessRate: 0,
      instantFailureRate: 0,
      timeoutRate: 0,
      networkErrorRate: 0,
      webhookOnlyRate: 0,
    });

    const result = await gateway.processPayment({
      paymentId: 'pay-123',
      amount: 100,
      currency: 'USD',
      merchantId: 'merch-1',
      customerEmail: 'test@example.com'
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('success');
    expect(result.gatewayReference).toMatch(/^gw_/);
  });

  it('should return instant failure based on configuration', async () => {
    // 100% instant failure
    const gateway = new GatewaySimulator({
      instantSuccessRate: 0,
      delayedSuccessRate: 0,
      instantFailureRate: 1.0,
      timeoutRate: 0,
      networkErrorRate: 0,
      webhookOnlyRate: 0,
    });

    const result = await gateway.processPayment({
      paymentId: 'pay-123',
      amount: 100,
      currency: 'USD',
      merchantId: 'merch-1',
      customerEmail: 'test@example.com'
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBeDefined();
    expect(result.errorMessage).toBeDefined();
  });

  it('should throw GatewayError on network error', async () => {
    // 100% network error
    const gateway = new GatewaySimulator({
      instantSuccessRate: 0,
      delayedSuccessRate: 0,
      instantFailureRate: 0,
      timeoutRate: 0,
      networkErrorRate: 1.0,
      webhookOnlyRate: 0,
    });

    await expect(gateway.processPayment({
      paymentId: 'pay-123',
      amount: 100,
      currency: 'USD',
      merchantId: 'merch-1',
      customerEmail: 'test@example.com'
    })).rejects.toThrow(GatewayError);
  });

  it('should return pending and trigger webhook later', async () => {
    jest.useFakeTimers();
    
    const gateway = new GatewaySimulator({
      instantSuccessRate: 0,
      delayedSuccessRate: 0,
      instantFailureRate: 0,
      timeoutRate: 0,
      networkErrorRate: 0,
      webhookOnlyRate: 1.0,
    });

    const webhookCallback = jest.fn();
    gateway.onWebhook(webhookCallback);

    const result = await gateway.processPayment({
      paymentId: 'pay-123',
      amount: 100,
      currency: 'USD',
      merchantId: 'merch-1',
      customerEmail: 'test@example.com'
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('pending');

    // Fast-forward timers to trigger the setTimeout in the simulator
    jest.runAllTimers();

    expect(webhookCallback).toHaveBeenCalledWith(
      'pay-123',
      expect.any(Boolean),
      result.gatewayReference
    );

    jest.useRealTimers();
  });
});
