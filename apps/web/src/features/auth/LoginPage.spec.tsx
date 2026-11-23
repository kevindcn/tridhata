import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
  }),
  ApiError: class ApiError extends Error {},
}));

describe('LoginPage Google SSO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Masuk dengan Akun Google" button', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: /masuk dengan akun google/i }),
    ).toBeInTheDocument();
  });

  it('displays friendly error banner when URL has UNREGISTERED_ACCOUNT error', () => {
    render(
      <MemoryRouter initialEntries={['/login?error=UNREGISTERED_ACCOUNT&email=budi%40gmail.com']}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/akun google \(budi@gmail\.com\) belum terdaftar/i),
    ).toBeInTheDocument();
  });

  it('displays friendly error banner when URL has ACCOUNT_INACTIVE error', () => {
    render(
      <MemoryRouter initialEntries={['/login?error=ACCOUNT_INACTIVE']}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/akun anda sedang dinonaktifkan/i),
    ).toBeInTheDocument();
  });
});

