import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const TRANSIENT_CONNECTION_ERROR_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1017', // Server closed the connection
  'P2024', // Connection pool timeout
]);

const DEFAULT_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 15000,
};

const READ_ACTIONS = new Set<string>([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prismaErrorCode(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

function isTransientPrismaConnectionError(error: unknown) {
  const code = prismaErrorCode(error);
  return code != null && TRANSIENT_CONNECTION_ERROR_CODES.has(code);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ transactionOptions: DEFAULT_TRANSACTION_OPTIONS });
  }

  async onModuleInit() {
    await this.connectWithRetry();
    this.installReadRetryMiddleware();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry() {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        return;
      } catch (error) {
        const retryable =
          isTransientPrismaConnectionError(error) && attempt < maxAttempts;
        if (!retryable) {
          throw error;
        }
        const delayMs = attempt * 300;
        this.logger.warn(
          `Database connect failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
      }
    }
  }

  private installReadRetryMiddleware() {
    this.$use(
      async (
        params: Prisma.MiddlewareParams,
        next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
      ) => {
        const shouldRetry = READ_ACTIONS.has(params.action);
        if (!shouldRetry) {
          return next(params);
        }

        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            return await next(params);
          } catch (error) {
            const retryable =
              isTransientPrismaConnectionError(error) && attempt < maxAttempts;
            if (!retryable) {
              throw error;
            }
            await sleep(150);
          }
        }

        return next(params);
      },
    );
  }
}
