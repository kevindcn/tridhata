import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const SalesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasi = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Ringkasan Penjualan — Pabrik {lokasi}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Performa penjualan, pencapaian target bulanan, dan proyeksi akhir bulan.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          Modul Dashboard Penjualan (Fase 3)
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
          Kartu KPI (Omzet, Qty Terjual, Target, Proyeksi, Estimasi Defisit), grafik tren harian, dan tabel performa produk per SKU akan aktif di Fase 3 setelah sinkronisasi data selesai dibangun.
        </p>
      </div>
    </div>
  );
};
