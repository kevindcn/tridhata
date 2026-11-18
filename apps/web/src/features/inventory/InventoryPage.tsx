import React from 'react';
import { Boxes } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const InventoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasi = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Status Persediaan & Buffer Stock — Pabrik {lokasi}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Monitoring stok kritis, buffer persediaan, dan nilai aset inventaris.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
          <Boxes className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          Modul Dashboard Persediaan (Fase 3)
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
          Klasifikasi status stok (SAFE, MINIMUM, CRITICAL, EMPTY), filter status, dan nilai stok per kategori akan hadir di Fase 3.
        </p>
      </div>
    </div>
  );
};
