import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { IncomingMessage } from 'http';

interface HttpExceptionResponse {
  statusCode: number;
  message: string;
  error: string;
}

export const getStatusCode = (exception: HttpException): number => {
  return exception instanceof HttpException
    ? exception.getStatus()
    : HttpStatus.INTERNAL_SERVER_ERROR;
};

export const formatErrorName = (exception: string): string => {
  if (!exception) {
    return '';
  }
  return exception.replace(/[A-Z]/g, ' $&').trim();
};

export const getErrorMessage = <T>(exception: T): string => {
  if (exception instanceof HttpException) {
    const errorResponse = exception.getResponse();
    const errorMessage =
      (errorResponse as HttpExceptionResponse).message || exception.message;

    return errorMessage;
  } else {
    return String(exception);
  }
};

export const getErrorResponse = <T>(exception: T): string | object => {
  if (exception instanceof HttpException) {
    return exception.getResponse();
  }
  return null;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<IncomingMessage>();
    const statusCode = getStatusCode(exception);
    const message = getErrorMessage(exception);
    const error = formatErrorName(exception.name);

    const fullErrorResponse = getErrorResponse(exception);

    const baseResponse = {
      message,
      error,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const finalResponse =
      fullErrorResponse &&
      typeof fullErrorResponse === 'object' &&
      'details' in fullErrorResponse
        ? { ...baseResponse, details: fullErrorResponse.details }
        : baseResponse;

    response.status(statusCode).json(finalResponse);
  }
}
