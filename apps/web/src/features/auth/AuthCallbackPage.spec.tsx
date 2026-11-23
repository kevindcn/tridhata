import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthCallbackPage } from './AuthCallbackPage';

const mockLoginWithTicket = vi.fn();
const mockNavigate = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    loginWithTicket: mockLoginWithTicket,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading indicator and exchanges ticket successfully', async () => {
    mockLoginWithTicket.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={['/auth/callback?ticket=valid-uuid-ticket']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/memverifikasi akun google anda/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockLoginWithTicket).toHaveBeenCalledWith('valid-uuid-ticket');
      expect(mockNavigate).toHaveBeenCalledWith('/penjualan', { replace: true });
    });
  });

  it('redirects to login with error when ticket is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login?error=AUTH_FAILED', { replace: true });
    });
  });
});

