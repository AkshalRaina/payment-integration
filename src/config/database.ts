import { PrismaClient } from '@prisma/client';
import { config } from './index';

/**
 * Prisma client singleton.
 * Uses query logging in development mode for debugging.
 */
const prisma = new PrismaClient({
  log:
    config.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
});

/**
 * Gracefully disconnect Prisma on process termination.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Verify database connectivity.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export { prisma };
