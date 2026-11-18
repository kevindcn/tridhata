import React from 'react';
import { FileCheck2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const ApprovalsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasi = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Pengajuan & Persetujuan Diskon — Pabrik {lokasi}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Alur pengajuan diskon dari Sales dan persetujuan bertingkat oleh Finance.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
          <FileCheck2 className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          Modul Persetujuan Diskon (Fase 4)
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
          Formulir pengajuan diskon oleh Sales/Staff dan tombol persetujuan bertingkat (Setujui / Tolak) oleh Finance akan dibangun pada Fase 4.
        </p>
      </div>
    </div>
  );
};
