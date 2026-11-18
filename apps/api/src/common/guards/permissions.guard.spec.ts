import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { AuthUser } from '@tridhata/shared';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user?: Partial<AuthUser>) => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('allows access if route is public', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = createMockContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access if no permissions are required', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce([]); // permissions
    const ctx = createMockContext({ permissions: ['dashboard:read'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException if user lacks required permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['approval:decide']);

    const ctx = createMockContext({
      permissions: ['dashboard:read', 'approval:create'],
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows access if user has all required permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['approval:decide']);

    const ctx = createMockContext({
      permissions: ['dashboard:read', 'approval:decide'],
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
