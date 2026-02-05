import {
  CallHandler,
  ExecutionContext,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { of, delay, lastValueFrom, throwError } from 'rxjs';
import { TimeoutInterceptor } from './timeout.interceptor';
import { IS_DISABLED_TIMEOUT } from '../decorators/disable-timeout.decorator';

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;
  let configService: ConfigService;
  let reflector: Reflector;

  const createMockContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  const createMockCallHandler = (observable = of('result')): CallHandler => ({
    handle: jest.fn().mockReturnValue(observable),
  });

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue(5000),
    } as unknown as ConfigService;

    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    interceptor = new TimeoutInterceptor(configService, reflector);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should use default timeout of 5000 when TIMEOUT env is not set', () => {
    const configServiceNoTimeout = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const inst = new TimeoutInterceptor(configServiceNoTimeout, reflector);
    expect(inst).toBeDefined();
  });

  it('should pass through the response when request completes within timeout', async () => {
    const context = createMockContext();
    const handler = createMockCallHandler(of('success'));

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toBe('success');
  });

  it('should throw RequestTimeoutException when request exceeds timeout', async () => {
    // Use a very short timeout for testing
    const shortConfigService = {
      get: jest.fn().mockReturnValue(10),
    } as unknown as ConfigService;
    const shortInterceptor = new TimeoutInterceptor(
      shortConfigService,
      reflector,
    );

    const context = createMockContext();
    const handler = createMockCallHandler(of('slow').pipe(delay(100)));

    const result$ = shortInterceptor.intercept(context, handler);

    await expect(lastValueFrom(result$)).rejects.toThrow(
      RequestTimeoutException,
    );
  });

  it('should rethrow non-timeout errors as-is', async () => {
    const context = createMockContext();
    const error = new Error('some other error');
    const handler = createMockCallHandler(throwError(() => error));

    const result$ = interceptor.intercept(context, handler);

    await expect(lastValueFrom(result$)).rejects.toThrow('some other error');
  });

  it('should skip timeout when @DisableTimeout is applied', async () => {
    const context = createMockContext();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

    const handler = createMockCallHandler(of('no-timeout'));

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toBe('no-timeout');
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_DISABLED_TIMEOUT,
      [context.getHandler(), context.getClass()],
    );
  });

  it('should read timeout value from ConfigService with key TIMEOUT', () => {
    expect(configService.get).toHaveBeenCalledWith('TIMEOUT', 5000);
  });
});
