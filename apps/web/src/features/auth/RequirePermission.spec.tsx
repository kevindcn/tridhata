import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RequirePermission } from './RequirePermission';
import * as AuthContextModule from './AuthContext';

describe('RequirePermission Component', () => {
  it('renders restricted access message when user lacks permission', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Staff',
        email: 'staff@tridhata.com',
        role: 'STAFF',
        permissions: ['dashboard:read'],
        locationIds: ['loc-1'],
        defaultLocationId: 'loc-1',
        mustChangePassword: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: (perm) => perm === 'dashboard:read',
    });

    render(
      <MemoryRouter>
        <RequirePermission permission="user:manage">
          <div>Protected Content</div>
        </RequirePermission>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Akses Terbatas')).toBeInTheDocument();
  });

  it('renders children when user has permission', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-admin',
        name: 'Admin',
        email: 'admin@tridhata.com',
        role: 'ADMIN',
        permissions: ['user:manage', 'dashboard:read'],
        locationIds: ['loc-1'],
        defaultLocationId: 'loc-1',
        mustChangePassword: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: (perm) => ['user:manage', 'dashboard:read'].includes(perm),
    });

    render(
      <MemoryRouter>
        <RequirePermission permission="user:manage">
          <div>Admin Content Protected</div>
        </RequirePermission>
      </MemoryRouter>,
    );

    expect(screen.getByText('Admin Content Protected')).toBeInTheDocument();
    expect(screen.queryByText('Akses Terbatas')).not.toBeInTheDocument();
  });
});
