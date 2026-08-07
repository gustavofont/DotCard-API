import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  errorCode: string;
  timestamp: string;
  path: string;
}

/**
 * Catches every unhandled exception and returns a sanitized, consistent
 * error shape. Internal errors are never leaked to the client — only logged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, errorCode } = this.resolveException(exception);

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    response.status(status).json(body);
  }

  private resolveException(exception: unknown): {
    status: number;
    message: string | string[];
    errorCode: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        return {
          status,
          message: (body.message as string | string[]) ?? exception.message,
          errorCode: (body.errorCode as string) ?? this.defaultErrorCode(status),
        };
      }

      return { status, message: exception.message, errorCode: this.defaultErrorCode(status) };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error.',
      errorCode: 'INTERNAL_SERVER_ERROR',
    };
  }

  private defaultErrorCode(status: number): string {
    return HttpStatus[status] ?? 'UNKNOWN_ERROR';
  }
}
