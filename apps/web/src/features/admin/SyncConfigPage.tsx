import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const SyncConfigPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasi = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Pengaturan Sinkronisasi Google Sheets — Pabrik {lokasi}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Konfigurasi pemetaan tab spreadsheet, trigger sinkronisasi manual, dan monitoring cron.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
          <RefreshCw className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          Konfigurasi Sinkronisasi (Fase 3)
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
          Pemetaan kolom Google Sheets ke skema database, trigger sinkronisasi manual per tab, dan laporan baris ditolak akan dibangun pada Fase 3.
        </p>
      </div>
    </div>
  );
};
