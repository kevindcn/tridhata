import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApprovalsPage } from './ApprovalsPage';
import * as apiClient from '@/lib/api-client';
import * as AuthContextModule from '@/features/auth/AuthContext';
import { RequestItem } from '@tridhata/shared';

const mockRequests: RequestItem[] = [
  {
    id: 'req-1',
    requesterId: 'user-staff-1',
    requester: {
      id: 'user-staff-1',
      name: 'Budi Sales',
      email: 'budi@tridhata.id',
    },
    locationId: 'loc-bogor',
    type: 'Diskon Khusus',
    title: 'Diskon volume order PT Maju',
    note: 'Order volume 500 karton',
    amount: 1500000,
    status: 'PENDING',
    version: 1,
    decidedAt: null,
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    approvals: [],
  },
  {
    id: 'req-2',
    requesterId: 'user-finance-1', // created by finance
    requester: {
      id: 'user-finance-1',
      name: 'Siti Finance',
      email: 'siti@tridhata.id',
    },
    locationId: 'loc-bogor',
    type: 'Penyesuaian Harga',
    title: 'Pengajuan harga khusus pabrik Bogor',
    note: null,
    amount: 500000,
    status: 'PENDING',
    version: 1,
    decidedAt: null,
    createdAt: '2026-11-18T11:00:00.000Z',
    updatedAt: '2026-11-18T11:00:00.000Z',
    approvals: [],
  },
  {
    id: 'req-3',
    requesterId: 'user-staff-1',
    requester: {
      id: 'user-staff-1',
      name: 'Budi Sales',
      email: 'budi@tridhata.id',
    },
    locationId: 'loc-bogor',
    type: 'Diskon Volume',
    title: 'Diskon batch Oktober',
    note: null,
    amount: 2000000,
    status: 'APPROVED',
    version: 2,
    decidedAt: '2026-11-18T12:00:00.000Z',
    createdAt: '2026-11-17T09:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    approvals: [
      {
        id: 'app-1',
        requestId: 'req-3',
        approverId: 'user-finance-1',
        approver: {
          id: 'user-finance-1',
          name: 'Siti Finance',
          email: 'siti@tridhata.id',
        },
        level: 1,
        decision: 'APPROVED',
        note: null,
        decidedAt: '2026-11-18T12:00:00.000Z',
      },
    ],
  },
];

describe('ApprovalsPage (SPEC Section 10.2 & Separation of Duties UI)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(apiClient, 'api').mockImplementation(async (path: string) => {
      if (path === '/locations') {
        return [{ id: 'loc-bogor', code: 'BOGOR', name: 'Pabrik Bogor' }];
      }
      if (path.startsWith('/approvals')) {
        return mockRequests;
      }
      return null;
    });
  });

  it('renders table, tabs with counts, and request details for Finance user', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-finance-1',
        name: 'Siti Finance',
        email: 'siti@tridhata.id',
        role: 'FINANCE',
        permissions: [
          'dashboard:read',
          'finance:read',
          'approval:create',
          'approval:read_all',
          'approval:decide',
        ],
        locationIds: ['loc-bogor'],
        defaultLocationId: 'loc-bogor',
        mustChangePassword: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: (perm) =>
        [
          'dashboard:read',
          'finance:read',
          'approval:create',
          'approval:read_all',
          'approval:decide',
        ].includes(perm),
    });

    render(
      <MemoryRouter initialEntries={['/persetujuan?lokasi=BOGOR']}>
        <ApprovalsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Persetujuan Operasional')).toBeInTheDocument();
    expect(screen.getByText('BOGOR')).toBeInTheDocument();

    // Check tabs
    expect(screen.getByText('Menunggu')).toBeInTheDocument();
    expect(screen.getByText('Disetujui')).toBeInTheDocument();
    expect(screen.getByText('Ditolak')).toBeInTheDocument();
    expect(screen.getByText('Semua')).toBeInTheDocument();

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Diskon volume order PT Maju')).toBeInTheDocument();
    });

    // Check formatted Rupiah
    expect(screen.getByText(/1\.500\.000/)).toBeInTheDocument();

    // Finance can decide other person's request (req-1)
    expect(screen.getByRole('button', { name: /^Setujui$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tolak$/i })).toBeInTheDocument();
  });

  it('enforces Separation of Duties: Admin cannot decide requests (SPEC line 201)', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-admin-1',
        name: 'Super Admin',
        email: 'admin@tridhata.id',
        role: 'ADMIN',
        // Admin explicitly has NO approval:decide per SPEC line 190-201
        permissions: [
          'dashboard:read',
          'finance:read',
          'approval:create',
          'approval:read_all',
          'user:manage',
        ],
        locationIds: ['loc-bogor'],
        defaultLocationId: 'loc-bogor',
        mustChangePassword: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: (perm) => perm !== 'approval:decide',
    });

    render(
      <MemoryRouter initialEntries={['/persetujuan?lokasi=BOGOR']}>
        <ApprovalsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Diskon volume order PT Maju')).toBeInTheDocument();
    });

    // Admin should only see "Detail", NEVER "Setujui" or "Tolak"
    expect(screen.queryByRole('button', { name: /^Setujui$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tolak$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Detail/i }).length).toBeGreaterThan(0);
  });

  it('enforces Self-Approval Guard: Requester cannot decide their own request', async () => {
    // User is Siti Finance, but looking at req-2 which she created
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-finance-1', // same as req-2 requesterId
        name: 'Siti Finance',
        email: 'siti@tridhata.id',
        role: 'FINANCE',
        permissions: ['approval:create', 'approval:read_all', 'approval:decide'],
        locationIds: ['loc-bogor'],
        defaultLocationId: 'loc-bogor',
        mustChangePassword: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: () => true,
    });

    render(
      <MemoryRouter initialEntries={['/persetujuan?lokasi=BOGOR']}>
        <ApprovalsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Pengajuan harga khusus pabrik Bogor')).toBeInTheDocument();
    });

    // In the table, req-2 was created by this user, so it should not have quick decide buttons
    // Find the row element
    const selfRow = screen.getByText('Pengajuan harga khusus pabrik Bogor').closest('tr');
    expect(selfRow).toBeInTheDocument();
    fireEvent.click(selfRow!);

    // Side sheet should open and display the separation of duties warning
    await waitFor(() => {
      expect(screen.getByText(/Pemisahan Tugas:/i)).toBeInTheDocument();
      expect(screen.getByText(/tidak dapat memutuskan pengajuan Anda sendiri/i)).toBeInTheDocument();
    });
  });

  it('opens "Buat Pengajuan" dialog when clicking button', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-staff-1',
        name: 'Budi Sales',
        email: 'budi@tridhata.id',
        role: 'STAFF',
        permissions: ['dashboard:read', 'approval:create'],
        locationIds: ['loc-bogor'],
        defaultLocationId: 'loc-bogor',
        mustChangePassword: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: (perm) => ['dashboard:read', 'approval:create'].includes(perm),
    });

    render(
      <MemoryRouter initialEntries={['/persetujuan?lokasi=BOGOR']}>
        <ApprovalsPage />
      </MemoryRouter>,
    );

    const createBtn = screen.getByRole('button', { name: /Buat Pengajuan/i });
    expect(createBtn).toBeInTheDocument();

    fireEvent.click(createBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Buat Pengajuan Baru')).toBeInTheDocument();
    expect(screen.getByLabelText(/Judul Pengajuan/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nilai Pengajuan/i)).toBeInTheDocument();
  });
});
