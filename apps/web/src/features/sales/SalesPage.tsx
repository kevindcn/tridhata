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
import { formatInt, formatRupiah, formatPct } from '@/lib/format';
import { downloadCsv } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      .catch((err) => {
        toast.error('Gagal memuat data lokasi: ' + err.message);
      });
  }, [lokasiParam]);

  // Load sales dashboard data
  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    api<SalesDashboard>(`/dashboard/sales?locationId=${locationId}&from=${from}&to=${to}`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        toast.error('Gagal memuat ringkasan penjualan: ' + err.message);
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
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            Aman
          </span>
        );
      case 'MINIMUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
            Minimal
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800">
            Kritis
          </span>
        );
      case 'EMPTY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
            Habis
          </span>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Ringkasan Penjualan — Pabrik {lokasiParam}
          </h1>
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
            Peringatan: Data sinkronisasi belum diperbarui lebih dari 2 jam. Angka di bawah mungkin belum mencerminkan data spreadsheet terbaru.
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card border border-border rounded-lg shadow-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-1">Periode:</span>
          <Button
            variant={activePreset === 'this-month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handlePreset('this-month')}
            className="h-7 text-xs px-2.5"
          >
            Bulan Ini
          </Button>
          <Button
            variant={activePreset === 'last-month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handlePreset('last-month')}
            className="h-7 text-xs px-2.5"
          >
            Bulan Lalu
          </Button>
          <Button
            variant={activePreset === 'last-30' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handlePreset('last-30')}
            className="h-7 text-xs px-2.5"
          >
            30 Hari
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setActivePreset('custom');
            }}
            className="h-7 px-2 border border-input rounded bg-background text-foreground text-xs"
          />
          <span className="text-muted-foreground">s.d.</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setActivePreset('custom');
            }}
            className="h-7 px-2 border border-input rounded bg-background text-foreground text-xs"
          />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omzet s.d. Hari Ini */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Omzet s.d. Hari Ini
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
              {data?.cards.revenue !== null && data?.cards.revenue !== undefined
                ? formatRupiah(data.cards.revenue)
                : '—'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {data?.cards.previousMonthRevenue !== null && data?.cards.previousMonthRevenue !== undefined ? (
                <span>Bulan lalu: {formatRupiah(data.cards.previousMonthRevenue)}</span>
              ) : (
                'Hanya staf dengan hak akses finansial'
              )}
            </p>
          </CardContent>
        </Card>

        {/* Qty Terjual & Capaian */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Qty Terjual & Capaian
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                {data ? formatInt(data.cards.soldQty) : '0'} Pcs
              </span>
              {data?.cards.soldVsForecastPct !== null && data?.cards.soldVsForecastPct !== undefined && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {formatPct(data.cards.soldVsForecastPct)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Target proporsional: {data ? formatInt(data.cards.forecastQty) : '0'} Pcs
            </p>
          </CardContent>
        </Card>

        {/* Proyeksi Akhir Bulan */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Proyeksi Akhir Bulan
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
              {data?.cards.projectedMonthEndQty !== null && data?.cards.projectedMonthEndQty !== undefined
                ? `${formatInt(data.cards.projectedMonthEndQty)} Pcs`
                : '0 Pcs'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Estimasi berbasis laju {data?.meta.daysElapsed || 1} dari {data?.meta.daysInMonth || 30} hari
            </p>
          </CardContent>
        </Card>

        {/* Estimasi Defisit & Nilai Stok */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Defisit Stok & Nilai
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-bold tracking-tight tabular-nums ${
                (data?.cards.shortageSkuCount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}>
                {data ? formatInt(data.cards.shortageSkuCount) : '0'} SKU
              </span>
              <span className="text-xs text-muted-foreground">
                ({data ? formatInt(data.cards.stockShortageQty || 0) : '0'} Pcs)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Nilai stok: {data?.cards.stockValue !== null && data?.cards.stockValue !== undefined
                ? formatRupiah(data.cards.stockValue)
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Sales Chart */}
      <Card className="shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Tren Penjualan Harian
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-64 w-full">
            {data?.daily && data.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="qtyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/60" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.slice(8, 10)}
                    className="text-[11px] text-muted-foreground"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    className="text-[11px] text-muted-foreground tabular-nums"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    formatter={(val) => [`${formatInt(Number(val))} Pcs`, 'Kuantitas']}
                    labelFormatter={(label) => `Tanggal: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="qty"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#qtyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Tidak ada data transaksi pada rentang tanggal ini.
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
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    Memuat data performa produk...
                  </TableCell>
                </TableRow>
              ) : !data?.products.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    Tidak ada produk ditemukan untuk lokasi ini.
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
                        <span className={item.pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}>
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
