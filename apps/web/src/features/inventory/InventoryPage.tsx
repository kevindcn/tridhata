import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Boxes,
  Download,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  AlertOctagon,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatInt, formatRupiah, formatDateTime } from '@/lib/format';
import { downloadCsv } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InventoryDashboard, StockStatus } from '@tridhata/shared';
import { toast } from 'sonner';

interface LocationItem {
  id: string;
  code: string;
  name: string;
}

export const InventoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasiParam = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<InventoryDashboard | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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

  // Load inventory dashboard data
  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    const query = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
    api<InventoryDashboard>(`/dashboard/inventory?locationId=${locationId}${query}`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        toast.error('Gagal memuat status persediaan: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [locationId, statusFilter]);

  // CSV export handler
  const handleExport = async () => {
    if (!locationId) return;
    setExporting(true);
    try {
      const query = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
      await downloadCsv(
        `/dashboard/inventory/export?locationId=${locationId}${query}`,
        `persediaan_${lokasiParam.toLowerCase()}_${statusFilter.toLowerCase()}.csv`,
      );
      toast.success('Berkas CSV persediaan berhasil diunduh');
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
            Status Persediaan — Pabrik {lokasiParam}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoring level stok fisik, ambang pengaman (buffer & safety stock), dan nilai total aset persediaan.
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
            Peringatan: Data sinkronisasi persediaan belum diperbarui lebih dari 2 jam. Posisi stok mungkin belum mencerminkan mutasi terkini.
          </span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total SKU */}
        <Card className="shadow-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">
              Total SKU
            </CardTitle>
            <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold tracking-tight text-foreground tabular-nums">
              {data ? formatInt(data.cards.totalSku) : '0'}
            </div>
          </CardContent>
        </Card>

        {/* Aman */}
        <Card className="shadow-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Aman
            </CardTitle>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {data ? formatInt(data.cards.safeCount) : '0'}
            </div>
          </CardContent>
        </Card>

        {/* Minimal */}
        <Card className="shadow-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Minimal
            </CardTitle>
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {data ? formatInt(data.cards.minimumCount) : '0'}
            </div>
          </CardContent>
        </Card>

        {/* Kritis */}
        <Card className="shadow-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
              Kritis
            </CardTitle>
            <AlertOctagon className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold tracking-tight text-orange-600 dark:text-orange-400 tabular-nums">
              {data ? formatInt(data.cards.criticalCount) : '0'}
            </div>
          </CardContent>
        </Card>

        {/* Habis */}
        <Card className="shadow-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
              Habis
            </CardTitle>
            <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
              {data ? formatInt(data.cards.emptyCount) : '0'}
            </div>
          </CardContent>
        </Card>

        {/* Total Nilai Stok */}
        <Card className="shadow-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">
              Total Nilai Stok
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-sm font-bold tracking-tight text-foreground truncate tabular-nums">
              {data?.cards.stockValue !== null && data?.cards.stockValue !== undefined
                ? formatRupiah(data.cards.stockValue)
                : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Filter & Table */}
      <Card className="shadow-xs overflow-hidden">
        <div className="p-3 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="ALL" className="text-xs px-3">Semua</TabsTrigger>
              <TabsTrigger value="SAFE" className="text-xs px-3">Aman</TabsTrigger>
              <TabsTrigger value="MINIMUM" className="text-xs px-3">Minimal</TabsTrigger>
              <TabsTrigger value="CRITICAL" className="text-xs px-3">Kritis</TabsTrigger>
              <TabsTrigger value="EMPTY" className="text-xs px-3">Habis</TabsTrigger>
            </TabsList>
          </Tabs>

          <span className="text-xs text-muted-foreground">
            Menampilkan {data?.rows.length || 0} SKU
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-28 text-xs font-semibold">SKU</TableHead>
                <TableHead className="text-xs font-semibold">Nama Produk</TableHead>
                <TableHead className="text-right text-xs font-semibold">Stok Fisik</TableHead>
                <TableHead className="text-right text-xs font-semibold">Min Stock</TableHead>
                <TableHead className="text-right text-xs font-semibold">Safety Stock</TableHead>
                <TableHead className="text-center text-xs font-semibold">Status Stok</TableHead>
                <TableHead className="text-right text-xs font-semibold">Nilai Persediaan</TableHead>
                <TableHead className="text-right text-xs font-semibold">Sinkron Terakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    Memuat daftar persediaan barang...
                  </TableCell>
                </TableRow>
              ) : !data?.rows.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    Tidak ada persediaan ditemukan untuk kategori status ini.
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
                    <TableCell className="text-right text-xs tabular-nums font-semibold text-foreground">
                      {formatInt(item.qty)} Pcs
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {formatInt(item.minStock)} Pcs
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {formatInt(item.safetyStock)} Pcs
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(item.status)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {item.value !== null && item.value !== undefined ? formatRupiah(item.value) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {item.syncedAt ? formatDateTime(item.syncedAt) : '—'}
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
