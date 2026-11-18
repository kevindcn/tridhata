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
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatInt, formatPct } from '@/lib/format';
import { downloadCsv } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      .catch((err) => {
        toast.error('Gagal memuat data lokasi: ' + err.message);
      });
  }, [lokasiParam]);

  // Load production dashboard data
  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    api<ProductionDashboard>(`/dashboard/production?locationId=${locationId}&period=${period}`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        toast.error('Gagal memuat rencana produksi: ' + err.message);
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
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Rencana & Realisasi Produksi — Pabrik {lokasiParam}
          </h1>
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
            className="h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || loading}
            className="h-8 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {exporting ? 'Mengunduh...' : 'Unduh CSV'}
          </Button>
        </div>
      </div>

      {/* Stale Warning Banner */}
      {data?.meta.stale && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-800 dark:text-amber-300 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Peringatan: Data sinkronisasi belum diperbarui lebih dari 2 jam. Realisasi produksi mungkin belum mencerminkan data lembar kerja terkini.
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg shadow-xs">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">Periode Produksi:</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-7 px-2 border border-input rounded bg-background text-foreground text-xs"
          />
        </div>
      </div>

      {/* KPI Cards Grid */}
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
              {data ? formatInt(data.cards.totalTarget) : '0'} Pcs
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
                {data ? formatInt(data.cards.totalActual) : '0'} Pcs
              </span>
              {data?.cards.achievementPct !== null && data?.cards.achievementPct !== undefined && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  data.cards.achievementPct >= 100
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
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
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {data ? formatInt(data.cards.skuReached) : '0'} SKU
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
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-xl font-bold tracking-tight tabular-nums ${
              (data?.cards.skuBelow || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
            }`}>
              {data ? formatInt(data.cards.skuBelow) : '0'} SKU
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Produk yang masih memiliki gap defisit produksi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Production Targets Table */}
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
                <TableHead className="text-right text-xs font-semibold">% Capaian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    Memuat data target dan realisasi produksi...
                  </TableCell>
                </TableRow>
              ) : !data?.rows.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    Tidak ada target produksi terdaftar untuk periode {period}.
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((item) => (
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
                      <span className={item.gap > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                        {item.gap > 0 ? `-${formatInt(item.gap)}` : `+${formatInt(Math.abs(item.gap))}`} Pcs
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-medium">
                      {item.pct !== null ? (
                        <span className={item.pct >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-foreground'}>
                          {formatPct(item.pct)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
