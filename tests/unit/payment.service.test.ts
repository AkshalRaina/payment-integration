import { paymentService } from '../../src/services/payment.service';
import { prisma } from '../../src/config/database';
import { paymentProducer } from '../../src/queue/payment.producer';
import { NotFoundError } from '../../src/utils/errors';
import { PaymentStatus } from '../../src/utils/constants';

// Mock dependencies
jest.mock('../../src/config/database', () => {
  const mockPrisma: any = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    paymentEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

jest.mock('../../src/queue/payment.producer', () => ({
  paymentProducer: {
    enqueuePayment: jest.fn(),
  },
}));

jest.mock('../../src/config/queue', () => ({
  paymentProcessQueue: { add: jest.fn(), client: Promise.resolve() },
  paymentRetryQueue: { add: jest.fn(), client: Promise.resolve() },
  closeQueues: jest.fn(),
}));

describe('PaymentService', () => {
  describe('createPayment', () => {
    it('should create a payment and enqueue it for processing', async () => {
      const mockPaymentData: any = {
        amount: 100,
        currency: 'USD',
        merchantId: 'merch_1',
        customerEmail: 'test@example.com',
      };

      const mockDbPayment = {
        id: 'pay_123',
        ...mockPaymentData,
        status: PaymentStatus.PENDING,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.payment.create as jest.Mock).mockResolvedValue(mockDbPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({ ...mockDbPayment, version: 1 });
      (paymentProducer.enqueuePayment as jest.Mock).mockResolvedValue(undefined);

      const result = await paymentService.createPayment(mockPaymentData);

      expect(result.id).toEqual(mockDbPayment.id);
      expect(result.status).toEqual(PaymentStatus.PENDING);
      const createArgs = (prisma.payment.create as jest.Mock).mock.calls[0][0];
      expect(String(createArgs.data.amount)).toEqual('100');
      expect(createArgs.data.currency).toEqual('USD');
      expect(createArgs.data.merchantId).toEqual('merch_1');
      expect(createArgs.data.status).toEqual('CREATED');
      expect(paymentProducer.enqueuePayment).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('getPayment', () => {
    it('should return payment with events if found', async () => {
      const mockDbPayment = {
        id: 'pay_123',
        amount: 100,
        currency: 'USD',
        merchantId: 'merch_1',
        status: PaymentStatus.SUCCESS,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentEvents: [
          {
            id: 'evt_1',
            type: 'PAYMENT_CREATED',
            fromStatus: null,
            toStatus: 'PENDING',
            createdAt: new Date(),
            eventData: {},
          },
        ],
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockDbPayment);

      const result = await paymentService.getPayment('pay_123');

      expect(result.id).toEqual(mockDbPayment.id);
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'pay_123' },
        include: { paymentEvents: { orderBy: { createdAt: 'asc' } } },
      });
    });

    it('should throw NotFoundError if payment not found', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(paymentService.getPayment('invalid_id')).rejects.toThrow(NotFoundError);
    });
  });
});
