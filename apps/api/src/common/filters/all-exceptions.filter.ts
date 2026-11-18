import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Logger } from 'nestjs-pino';
import { ErrorCode, ErrorResponse } from '@tridhata/shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL';
    let message = 'Terjadi kesalahan pada server';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (resObj.code) {
          code = resObj.code as ErrorCode;
        } else {
          code = this.statusToCode(status);
        }

        if (status === HttpStatus.TOO_MANY_REQUESTS) {
          code = 'RATE_LIMITED';
          message = 'Terlalu banyak percobaan masuk. Silakan tunggu beberapa saat sebelum mencoba kembali.';
        } else if (resObj.message) {
          if (Array.isArray(resObj.message)) {
            message = resObj.message.join(', ');
          } else {
            const rawMsg = String(resObj.message);
            message = rawMsg.includes('ThrottlerException')
              ? 'Terlalu banyak percobaan masuk. Silakan tunggu beberapa saat sebelum mencoba kembali.'
              : rawMsg;
          }
        } else {
          message = this.statusToMessage(status);
        }

        details = resObj.details !== undefined ? resObj.details : null;
      } else if (typeof res === 'string') {
        code = this.statusToCode(status);
        message = res;
      }
    } else {
      this.logger.error({ err: exception }, 'Unhandled Exception Occurred');
    }

    const payload: ErrorResponse = {
      code,
      message,
      details,
    };

    response.status(status).send(payload);
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL';
    }
  }

  private statusToMessage(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Permintaan tidak valid';
      case HttpStatus.UNAUTHORIZED:
        return 'Sesi tidak valid atau telah kedaluwarsa';
      case HttpStatus.FORBIDDEN:
        return 'Anda tidak punya izin untuk aksi ini';
      case HttpStatus.NOT_FOUND:
        return 'Data tidak ditemukan';
      case HttpStatus.CONFLICT:
        return 'Terjadi konflik data';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi';
      default:
        return 'Terjadi kesalahan pada server';
    }
  }
}
