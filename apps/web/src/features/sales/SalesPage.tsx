import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Download,
  AlertTriangle,
  Package,
  Calendar,
  Layers,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api-client';
import { formatInt, formatRupiah, formatPct, formatDateTime } from '@/lib/format';
import { downloadCsv } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { SalesDashboard, StockStatus } from '@tridhata/shared';
import { toast } from 'sonner';

interface LocationItem {
  id: string;
  code: string;
  name: string;
}

export const SalesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasiParam = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<SalesDashboard | null>(null);

  // Date range presets state
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const startOfMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  const [from, setFrom] = useState<string>(startOfMonthStr);
  const [to, setTo] = useState<string>(todayStr);
  const [activePreset, setActivePreset] = useState<'this-month' | 'last-month' | 'last-30' | 'custom'>('this-month');

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

  // Load sales dashboard data
  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    api<SalesDashboard>(`/dashboard/sales?locationId=${locationId}&from=${from}&to=${to}`)
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Data penjualan gagal dimuat. Periksa koneksi, lalu coba lagi.';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [locationId, from, to]);

  // Date preset handlers
  const handlePreset = (preset: 'this-month' | 'last-month' | 'last-30') => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'this-month') {
      const f = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setFrom(f);
      setTo(todayStr);
    } else if (preset === 'last-month') {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      setFrom(`${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}-01`);
      setTo(`${lastDayPrevMonth.getFullYear()}-${pad(lastDayPrevMonth.getMonth() + 1)}-${pad(lastDayPrevMonth.getDate())}`);
    } else if (preset === 'last-30') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFrom(past30.toISOString().slice(0, 10));
      setTo(todayStr);
    }
  };

  // CSV export handler
  const handleExport = async () => {
    if (!locationId) return;
    setExporting(true);
    try {
      await downloadCsv(
        `/dashboard/sales/export?locationId=${locationId}&from=${from}&to=${to}`,
        `penjualan_${lokasiParam.toLowerCase()}_${from}_${to}.csv`,
      );
      toast.success('Berkas CSV penjualan berhasil diunduh');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh CSV';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: StockStatus) => {
    switch (status) {
      case 'SAFE':
        return <Badge variant="safe">Aman</Badge>;
      case 'MINIMUM':
        return <Badge variant="minimum">Minimal</Badge>;
      case 'CRITICAL':
        return <Badge variant="critical">Kritis</Badge>;
      case 'EMPTY':
        return <Badge variant="empty">Habis</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // SPEC 9.6: Financial cards are rendered only if cards.revenue !== null
  const hasFinanceAccess = data?.cards.revenue !== null && data?.cards.revenue !== undefined;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Ringkasan Penjualan — Pabrik {lokasiParam}
            </h1>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {from} s.d. {to}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Performa penjualan riil, perbandingan target proporsional, dan proyeksi akhir bulan.
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-card border border-border rounded-lg shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">Periode:</span>
          <Button
            variant={activePreset === 'this-month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handlePreset('this-month')}
            className="h-7 text-xs px-2.5 shrink-0"
          >
            Bulan Ini
          </Button>
          <Button
            variant={activePreset === 'last-month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handlePreset('last-month')}
            className="h-7 text-xs px-2.5 shrink-0"
          >
            Bulan Lalu
          </Button>
          <Button
            variant={activePreset === 'last-30' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handlePreset('last-30')}
            className="h-7 text-xs px-2.5 shrink-0"
          >
            30 Hari
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setActivePreset('custom');
            }}
            className="h-8 px-2 border border-input rounded bg-background text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <span className="text-muted-foreground">s.d.</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setActivePreset('custom');
            }}
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

      {/* KPI Cards Grid (SPEC 9.6: Five StatCards, financial omitted when null) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ) : data ? (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasFinanceAccess ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-3'} gap-4`}>
          {/* 1. Omzet s.d. Hari Ini (Only if finance:read per SPEC 9.6) */}
          {hasFinanceAccess && (
            <Card className="shadow-xs">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Omzet s.d. Hari Ini
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatRupiah(data.cards.revenue || 0)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {data.cards.previousMonthRevenue !== null && data.cards.previousMonthRevenue !== undefined ? (
                    <span>Bulan lalu: {formatRupiah(data.cards.previousMonthRevenue)}</span>
                  ) : (
                    'Data bulan lalu tidak tersedia'
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 2. Terjual vs Forecast (SPEC 9.6: Terjual vs forecast, nilai persen, subteks X dari Y pcs) */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Terjual vs Forecast
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatPct(data.cards.soldVsForecastPct)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ({formatInt(data.cards.soldQty)} Pcs)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                {formatInt(data.cards.soldQty)} dari {formatInt(data.cards.forecastQty)} pcs target proporsional
              </p>
            </CardContent>
          </Card>

          {/* 3. Proyeksi Akhir Bulan (SPEC 9.6) */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Proyeksi Akhir Bulan
              </CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                {data.cards.projectedMonthEndQty !== null && data.cards.projectedMonthEndQty !== undefined
                  ? `${formatInt(data.cards.projectedMonthEndQty)} Pcs`
                  : '0 Pcs'}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Laju {data.meta.daysElapsed || 1} dari {data.meta.daysInMonth || 30} hari berjalan
              </p>
            </CardContent>
          </Card>

          {/* 4. Kekurangan Stok s.d. Akhir Bulan (SPEC 9.6: X SKU kurang · Y SKU habis) */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Kekurangan Stok
              </CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-bold tracking-tight tabular-nums ${
                  data.cards.shortageSkuCount > 0 ? 'text-status-critical' : 'text-foreground'
                }`}>
                  {formatInt(data.cards.shortageSkuCount)} SKU
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ({formatInt(data.cards.stockShortageQty || 0)} Pcs)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                {data.cards.shortageSkuCount} SKU kurang · {data.cards.emptySkuCount} SKU sudah habis
              </p>
            </CardContent>
          </Card>

          {/* 5. Nilai Stok Produk Jadi (Only if finance:read per SPEC 9.6) */}
          {hasFinanceAccess && (
            <Card className="shadow-xs">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Nilai Stok Produk Jadi
                </CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatRupiah(data.cards.stockValue || 0)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                  {data.cards.criticalSkuCount} kritis · {data.cards.emptySkuCount} habis
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Daily Sales Chart (SPEC 9.4 Poin 1 & 9.6: Satu seri, tanpa gradien, tanpa 3D) */}
      <Card className="shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Tren Penjualan Harian
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-64 w-full">
            {loading ? (
              <Skeleton className="h-full w-full rounded-md" />
            ) : data?.daily && data.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(8, 10)}
                    className="text-[11px]"
                    tick={{ fill: '#64748B' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    className="text-[11px] tabular-nums"
                    tick={{ fill: '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E5E7EB',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#1F2937',
                    }}
                    formatter={(val) => [`${formatInt(Number(val))} Pcs`, 'Kuantitas']}
                    labelFormatter={(label) => `Tanggal: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="qty"
                    stroke="#006B45"
                    strokeWidth={2}
                    fill="#E8F4EC"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Belum ada penjualan pada rentang ini. Ubah rentang tanggal atau periksa sinkron terakhir.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">
            Rincian Performa Produk ({data?.products.length || 0} SKU)
          </CardTitle>
        </CardHeader>
        <div className="border-t border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-28 text-xs font-semibold">SKU</TableHead>
                <TableHead className="text-xs font-semibold">Nama Produk</TableHead>
                <TableHead className="text-right text-xs font-semibold">Terjual</TableHead>
                <TableHead className="text-right text-xs font-semibold">Target Prop.</TableHead>
                <TableHead className="text-right text-xs font-semibold">% Capaian</TableHead>
                <TableHead className="text-right text-xs font-semibold">Stok Fisik</TableHead>
                <TableHead className="text-center text-xs font-semibold">Status Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    </TableRow>
                  ))}
                </>
              ) : !data?.products.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">
                      Belum ada penjualan pada rentang ini.
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Ubah rentang tanggal atau periksa jadwal sinkronisasi terakhir.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                data.products.map((item) => (
                  <TableRow key={item.sku} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-medium text-foreground">
                      {item.sku}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">
                      {item.name}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-foreground">
                      {formatInt(item.soldQty)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {formatInt(item.forecastQty)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-medium">
                      {item.pct !== null ? (
                        <span className={item.pct >= 100 ? 'text-status-safe font-semibold' : 'text-foreground'}>
                          {formatPct(item.pct)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-semibold text-foreground">
                      {formatInt(item.stockQty)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(item.status)}
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
