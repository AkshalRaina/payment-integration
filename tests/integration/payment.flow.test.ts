import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/config/database';
import { redis } from '../../src/config/redis';
import { paymentProcessQueue, paymentRetryQueue } from '../../src/config/queue';

describe('Payment Flow Integration', () => {
  let paymentId: string;
  const idempotencyKey = 'flow-test-key-1';

  afterAll(async () => {
    // Cleanup created test data
    if (paymentId) {
      await prisma.paymentEvent.deleteMany({ where: { paymentId } });
      await prisma.payment.delete({ where: { id: paymentId } });
    }
    await redis.del(`idempotency:${idempotencyKey}`);
    await prisma.idempotencyKey.deleteMany({ where: { key: idempotencyKey } });
  });

  it('should successfully create a payment and enqueue it', async () => {
    const payload = {
      amount: 500,
      currency: 'USD',
      merchantId: 'merch_test_1',
      customerEmail: 'integration@example.com',
    };

    const response = await request(app)
      .post('/api/v1/payments')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.amount).toBe('500');
    expect(response.body.data.status).toBe('PENDING');

    paymentId = response.body.data.id;

    // Verify it was enqueued
    const jobs = await paymentProcessQueue.getJobs(['waiting', 'active']);
    const job = jobs.find((j) => j.data.paymentId === paymentId);
    
    expect(job).toBeDefined();
    
    // Clean up job
    if (job) await job.remove();
  });

  it('should fetch the created payment', async () => {
    const response = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(paymentId);
    expect(response.body.data.status).toBe('PENDING');
    // Events should include CREATED and PENDING
    expect(response.body.data.events.length).toBeGreaterThanOrEqual(2);
  });
});
