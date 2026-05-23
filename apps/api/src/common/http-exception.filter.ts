import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    let message: string | string[] =
      exception instanceof HttpException ? exception.message : 'Internal server error';
    if (raw && typeof raw === 'object' && 'message' in raw) {
      message = (raw as { message: string | string[] }).message;
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
