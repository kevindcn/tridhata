import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MustChangePasswordGuard } from './must-change-password.guard';

describe('MustChangePasswordGuard', () => {
  let guard: MustChangePasswordGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new MustChangePasswordGuard(reflector);
  });

  const createMockContext = (url: string, mustChangePassword = false) => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          url,
          user: { mustChangePassword },
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('allows public endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = createMockContext('/dashboard/sales', true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows /auth/* and /me even if mustChangePassword is true', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(guard.canActivate(createMockContext('/auth/change-password', true))).toBe(true);
    expect(guard.canActivate(createMockContext('/auth/logout', true))).toBe(true);
    expect(guard.canActivate(createMockContext('/me', true))).toBe(true);
  });

  it('blocks other routes if mustChangePassword is true', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(() => guard.canActivate(createMockContext('/dashboard/sales', true))).toThrow(
      ForbiddenException,
    );
  });

  it('allows other routes if mustChangePassword is false', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(guard.canActivate(createMockContext('/dashboard/sales', false))).toBe(true);
  });
});
