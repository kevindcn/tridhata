import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SalesPage } from './SalesPage';
import * as apiClient from '@/lib/api-client';

describe('SalesPage (SPEC Section 8 & Anti-slop UI)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders benchmark KPI data and displays "—" for masked financial fields', async () => {
    // Mock api calls
    vi.spyOn(apiClient, 'api').mockImplementation(async (path: string) => {
      if (path === '/locations') {
        return [{ id: 'loc-1', code: 'BGR', name: 'Bogor' }];
      }
      if (path.startsWith('/dashboard/sales')) {
        return {
          meta: {
            locationId: 'loc-1',
            from: '2026-04-01',
            to: '2026-04-18',
            daysElapsed: 18,
            daysInMonth: 30,
            lastSuccessAt: '2026-04-18T10:00:00Z',
            stale: false,
          },
          cards: {
            revenue: null, // Masked because user lacks finance:read
            previousMonthRevenue: null,
            soldQty: 30,
            forecastQty: 2051,
            soldVsForecastPct: 1.46,
            projectedMonthEndQty: 50,
            stockShortageQty: 15,
            shortageSkuCount: 1,
            emptySkuCount: 0,
            criticalSkuCount: 1,
            stockValue: null,
          },
          daily: [
            { date: '2026-04-10', qty: 30, revenue: null },
          ],
          products: [
            {
              sku: 'SKU-001',
              name: 'Produk Uji 1',
              soldQty: 30,
              forecastQty: 2051,
              pct: 1.46,
              stockQty: 5,
              status: 'CRITICAL',
            },
          ],
        };
      }
      return null;
    });

    render(
      <MemoryRouter initialEntries={['/penjualan?lokasi=bgr']}>
        <SalesPage />
      </MemoryRouter>,
    );

    // Verify Title
    expect(screen.getByText(/Ringkasan Penjualan — Pabrik BGR/i)).toBeInTheDocument();

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('(30 Pcs)')).toBeInTheDocument();
    });

    // Check proportional forecast and projected
    expect(screen.getByText(/pcs target proporsional/i)).toBeInTheDocument();
    expect(screen.getByText('50 Pcs')).toBeInTheDocument();
    expect(screen.getByText(/1 SKU Kurang/i)).toBeInTheDocument();

    // Check SPEC 9.6: masked financial cards are omitted when user lacks finance:read
    expect(screen.queryByText('Omzet s.d. Hari Ini')).not.toBeInTheDocument();
    expect(screen.queryByText('Nilai Stok Produk Jadi')).not.toBeInTheDocument();

    // Check product row and status badge
    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText('Produk Uji 1')).toBeInTheDocument();
    expect(screen.getByText('Kritis')).toBeInTheDocument();
  });

  it('renders Omzet and Nilai Stok cards when finance:read data is provided (SPEC 9.6)', async () => {
    vi.spyOn(apiClient, 'api').mockImplementation(async (path: string) => {
      if (path === '/locations') {
        return [{ id: 'loc-1', code: 'BGR', name: 'Bogor' }];
      }
      if (path.startsWith('/dashboard/sales')) {
        return {
          meta: {
            locationId: 'loc-1',
            from: '2026-04-01',
            to: '2026-04-18',
            daysElapsed: 18,
            daysInMonth: 30,
            lastSuccessAt: '2026-04-18T10:00:00Z',
            stale: false,
          },
          cards: {
            revenue: 250000000,
            previousMonthRevenue: 240000000,
            soldQty: 30,
            forecastQty: 2051,
            soldVsForecastPct: 1.46,
            projectedMonthEndQty: 50,
            stockShortageQty: 15,
            shortageSkuCount: 1,
            emptySkuCount: 0,
            criticalSkuCount: 1,
            stockValue: 50000000,
          },
          daily: [
            { date: '2026-04-10', qty: 30, revenue: 250000000 },
          ],
          products: [
            {
              sku: 'SKU-001',
              name: 'Produk Uji 1',
              soldQty: 30,
              forecastQty: 2051,
              pct: 1.46,
              stockQty: 5,
              status: 'CRITICAL',
            },
          ],
        };
      }
      return null;
    });

    render(
      <MemoryRouter initialEntries={['/penjualan?lokasi=bgr']}>
        <SalesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Omzet s.d. Hari Ini')).toBeInTheDocument();
    });
    expect(screen.getByText('Nilai Stok Produk Jadi')).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*250\.000\.000/)).toBeInTheDocument();
  });
});
