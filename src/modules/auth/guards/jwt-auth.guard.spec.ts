/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE } from '../../../shared/decorators/public-route.decorator';

// Mock @nestjs/passport before importing the guard
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () =>
    class MockAuthGuard {
      canActivate(_context: ExecutionContext) {
        return true;
      }
    },
}));

import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;

    guard = new JwtAuthGuard(reflector);
  });

  const createMockContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when route is marked as public', () => {
      const context = createMockContext();
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_ROUTE,
        [context.getHandler(), context.getClass()],
      );
    });

    it('should delegate to super.canActivate when route is not public', () => {
      const context = createMockContext();
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

      // super.canActivate (mocked) returns true
      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should delegate to super when metadata is undefined', () => {
      const context = createMockContext();
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
