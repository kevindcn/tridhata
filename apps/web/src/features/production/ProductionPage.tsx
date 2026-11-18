import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Factory,
  Download,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatInt, formatPct, formatDateTime } from '@/lib/format';
import { downloadCsv } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductionDashboard } from '@tridhata/shared';
import { toast } from 'sonner';

interface LocationItem {
  id: string;
  code: string;
  name: string;
}

export const ProductionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasiParam = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<ProductionDashboard | null>(null);

  // Period state (default current month: YYYY-MM)
  const currentPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [period, setPeriod] = useState<string>(currentPeriod);

  // Load locations to resolve locationId from code
  useEffect(() => {
    api<LocationItem[]>('/locations')
      .then((locs) => {
        const found = locs.find((l) => l.code.toUpperCase() === lokasiParam) || locs[0];
        if (found) {
          setLocationId(found.id);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Gagal memuat data lokasi';
        toast.error(msg);
      });
  }, [lokasiParam]);

  // Load production dashboard data
  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    api<ProductionDashboard>(`/dashboard/production?locationId=${locationId}&period=${period}`)
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Data produksi gagal dimuat. Periksa koneksi, lalu coba lagi.';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [locationId, period]);

  // CSV export handler
  const handleExport = async () => {
    if (!locationId) return;
    setExporting(true);
    try {
      await downloadCsv(
        `/dashboard/production/export?locationId=${locationId}&period=${period}`,
        `rencana_produksi_${lokasiParam.toLowerCase()}_${period}.csv`,
      );
      toast.success('Berkas CSV rencana produksi berhasil diunduh');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh CSV';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Capaian Target Produksi — Pabrik {lokasiParam}
            </h1>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              Periode {period}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoring target bulanan, realisasi pabrik, dan analisis gap pencapaian per SKU.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-8 text-xs min-h-[36px] sm:min-h-[32px]"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || loading}
            className="h-8 text-xs min-h-[36px] sm:min-h-[32px]"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {exporting ? 'Mengunduh...' : 'Unduh CSV'}
          </Button>
        </div>
      </div>

      {/* Stale Warning Banner (SPEC 9.4 Poin 10) */}
      {data?.meta.stale && (
        <div className="flex items-center gap-2 p-3 bg-warning-bg border border-warning/30 rounded-md text-warning text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span>
            Data terakhir diperbarui {data.meta.lastSuccessAt ? formatDateTime(data.meta.lastSuccessAt) : 'belum pernah'}. Angka di bawah mungkin belum mencerminkan kondisi terbaru.
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg shadow-xs">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground">Periode Produksi:</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-8 px-2 border border-input rounded bg-background text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Error State with Retry Button (SPEC 9.4 Poin 9) */}
      {error && !loading && (
        <div className="p-8 text-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive shadow-xs">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={fetchData}
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* KPI Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Target */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Target Produksi
              </CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                {formatInt(data.cards.totalTarget)} Pcs
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Akumulasi rencana produksi periode {period}
              </p>
            </CardContent>
          </Card>

          {/* Total Realisasi & % Capaian */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Realisasi Produksi
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatInt(data.cards.totalActual)} Pcs
                </span>
                {data.cards.achievementPct !== null && data.cards.achievementPct !== undefined && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    data.cards.achievementPct >= 100
                      ? 'bg-status-safe-bg text-status-safe'
                      : 'bg-accent text-accent-foreground'
                  }`}>
                    {formatPct(data.cards.achievementPct)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Hasil output riil yang dicatat dari lembar kerja
              </p>
            </CardContent>
          </Card>

          {/* SKU Tercapai */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                SKU Memenuhi Target
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-status-safe" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl font-bold tracking-tight text-status-safe tabular-nums">
                {formatInt(data.cards.skuReached)} SKU
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Produk dengan realisasi ≥ 100% target
              </p>
            </CardContent>
          </Card>

          {/* SKU di Bawah Target */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                SKU Kurang dari Target
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={`text-xl font-bold tracking-tight tabular-nums ${
                data.cards.skuBelow > 0 ? 'text-warning' : 'text-foreground'
              }`}>
                {formatInt(data.cards.skuBelow)} SKU
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Produk yang masih memiliki gap defisit produksi
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Production Targets Table with 4px Progress Bar (SPEC 9.6) */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">
            Target vs Realisasi per SKU ({data?.rows.length || 0} SKU)
          </CardTitle>
        </CardHeader>
        <div className="border-t border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-28 text-xs font-semibold">SKU</TableHead>
                <TableHead className="text-xs font-semibold">Nama Produk</TableHead>
                <TableHead className="text-right text-xs font-semibold">Target</TableHead>
                <TableHead className="text-right text-xs font-semibold">Realisasi</TableHead>
                <TableHead className="text-right text-xs font-semibold">Selisih (Gap)</TableHead>
                <TableHead className="w-36 text-right text-xs font-semibold">% Capaian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </>
              ) : !data?.rows.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">
                      Belum ada target produksi terdaftar untuk periode {period}.
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pilih periode lain atau lakukan sinkronisasi data melalui menu Administrasi.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((item) => {
                  const pctVal = item.pct ?? 0;
                  const isComplete = pctVal >= 100;
                  return (
                    <TableRow key={item.sku} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {item.sku}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatInt(item.target)} Pcs
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-semibold text-foreground">
                        {formatInt(item.actual)} Pcs
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        <span className={item.gap > 0 ? 'text-warning font-medium' : 'text-status-safe font-medium'}>
                          {item.gap > 0 ? `-${formatInt(item.gap)}` : `+${formatInt(Math.abs(item.gap))}`} Pcs
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        <div className="flex flex-col items-end gap-1">
                          <span className={isComplete ? 'text-status-safe font-semibold' : 'text-foreground font-medium'}>
                            {formatPct(item.pct)}
                          </span>
                          {/* 4px thin progress bar per SPEC 9.6 */}
                          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isComplete ? 'bg-status-safe' : 'bg-primary'
                              }`}
                              style={{ width: `${Math.min(pctVal, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
