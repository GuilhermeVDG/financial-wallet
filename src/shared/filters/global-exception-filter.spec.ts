import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalExceptionFilter,
  getStatusCode,
  formatErrorName,
  getErrorMessage,
  getErrorResponse,
} from './global-exception-filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('getStatusCode', () => {
    it('should return exception status for HttpException', () => {
      const exception = new BadRequestException('bad');
      expect(getStatusCode(exception)).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 500 for non-HttpException', () => {
      const exception = new Error('unknown') as any;
      expect(getStatusCode(exception)).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('formatErrorName', () => {
    it('should format CamelCase to spaced words', () => {
      expect(formatErrorName('BadRequestException')).toBe(
        'Bad Request Exception',
      );
    });

    it('should return empty string for falsy input', () => {
      expect(formatErrorName('')).toBe('');
      expect(formatErrorName(null as any)).toBe('');
      expect(formatErrorName(undefined as any)).toBe('');
    });
  });

  describe('getErrorMessage', () => {
    it('should return message from HttpException response object', () => {
      const exception = new BadRequestException('invalid input');
      const message = getErrorMessage(exception);
      expect(message).toBe('invalid input');
    });

    it('should fallback to exception.message when response has no message field', () => {
      const exception = new HttpException(
        { statusCode: 400, error: 'Bad Request' },
        400,
      );
      const message = getErrorMessage(exception);
      // response.message is undefined, so it falls back to exception.message
      expect(typeof message).toBe('string');
      expect(message).toBeTruthy();
    });

    it('should return String(exception) for non-HttpException', () => {
      expect(getErrorMessage('plain error')).toBe('plain error');
      expect(getErrorMessage(42)).toBe('42');
    });
  });

  describe('getErrorResponse', () => {
    it('should return full response for HttpException', () => {
      const exception = new BadRequestException('bad');
      const response = getErrorResponse(exception);
      expect(response).toEqual(
        expect.objectContaining({ message: 'bad', statusCode: 400 }),
      );
    });

    it('should return null for non-HttpException', () => {
      expect(getErrorResponse(new Error('err'))).toBeNull();
      expect(getErrorResponse('string error')).toBeNull();
    });
  });

  describe('catch', () => {
    const createMockHost = (url = '/test'): ArgumentsHost => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      return {
        switchToHttp: jest.fn().mockReturnValue({
          getResponse: jest.fn().mockReturnValue({ status }),
          getRequest: jest.fn().mockReturnValue({ url }),
        }),
      } as unknown as ArgumentsHost;
    };

    it('should respond with correct status and body for HttpException', () => {
      const exception = new NotFoundException('Resource not found');
      const host = createMockHost('/api/resource');

      filter.catch(exception, host);

      const httpCtx = host.switchToHttp();
      const response = (httpCtx.getResponse as jest.Mock)();

      expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('should include timestamp in the response', () => {
      const exception = new BadRequestException('bad');
      const host = createMockHost();

      filter.catch(exception, host);

      const httpCtx = host.switchToHttp();
      const response = (httpCtx.getResponse as jest.Mock)();
      const statusFn = response.status;
      const jsonFn = statusFn.mock.results[0].value.json;
      const body = jsonFn.mock.calls[0][0];

      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    });

    it('should include details when exception response has details field', () => {
      const exception = new HttpException(
        { message: 'Validation failed', details: [{ field: 'name' }] },
        HttpStatus.BAD_REQUEST,
      );
      const host = createMockHost();

      filter.catch(exception as any, host);

      const httpCtx = host.switchToHttp();
      const response = (httpCtx.getResponse as jest.Mock)();
      const jsonFn = response.status.mock.results[0].value.json;
      const body = jsonFn.mock.calls[0][0];

      expect(body.details).toEqual([{ field: 'name' }]);
    });

    it('should not include details when exception response has no details', () => {
      const exception = new BadRequestException('simple error');
      const host = createMockHost();

      filter.catch(exception, host);

      const httpCtx = host.switchToHttp();
      const response = (httpCtx.getResponse as jest.Mock)();
      const jsonFn = response.status.mock.results[0].value.json;
      const body = jsonFn.mock.calls[0][0];

      expect(body.details).toBeUndefined();
    });
  });
});
