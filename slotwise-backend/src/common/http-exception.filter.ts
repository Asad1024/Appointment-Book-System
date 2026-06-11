import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const prismaError = exception as { code?: string } | null;
    const schemaMismatch =
      prismaError?.code === 'P2021' || prismaError?.code === 'P2022';

    const status = schemaMismatch
      ? HttpStatus.BAD_REQUEST
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isDev = process.env.NODE_ENV !== 'production';
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    let message: string | string[] =
      schemaMismatch
        ? 'Database schema is not up to date. Run Prisma migrations on Render, then try again.'
        : exception instanceof HttpException
          ? exception.message
          : isDev && exception instanceof Error
            ? exception.message
            : 'Internal server error';
    if (raw && typeof raw === 'object' && 'message' in raw) {
      message = (raw as { message: string | string[] }).message;
    }

    if (status >= 500) {
      const path = req.url;
      const method = req.method;
      const detail =
        exception instanceof Error
          ? `${exception.name}: ${exception.message}`
          : String(exception);
      this.logger.error(`[${method}] ${path} -> ${status}: ${detail}`);
      if (exception instanceof Error && exception.stack) {
        this.logger.error(exception.stack);
      }
    }

    const payload: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    };

    if (raw && typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (key === 'message' || key === 'statusCode' || key === 'error') continue;
        payload[key] = value;
      }
    }

    res.status(status).json(payload);
  }
}
