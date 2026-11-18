import React from 'react';
import { Factory } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const ProductionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasi = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Rencana & Realisasi Produksi — Pabrik {lokasi}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Monitoring target produksi, realisasi harian, dan analisis gap per SKU.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
          <Factory className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          Modul Dashboard Produksi (Fase 3)
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
          Tabel monitoring target versus aktual produksi serta pelacakan pencapaian target bulanan akan hadir di Fase 3.
        </p>
      </div>
    </div>
  );
};
