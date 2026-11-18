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
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatInt, formatRupiah, formatDateTime } from '@/lib/format';
import { downloadCsv } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [error, setError] = useState<string | null>(null);
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
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Gagal memuat data lokasi';
        toast.error(msg);
      });
  }, [lokasiParam]);

  // Load inventory dashboard data
  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    const query = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
    api<InventoryDashboard>(`/dashboard/inventory?locationId=${locationId}${query}`)
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Data persediaan gagal dimuat. Periksa koneksi, lalu coba lagi.';
        setError(msg);
        toast.error(msg);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Persediaan Barang — Pabrik {lokasiParam}
            </h1>
            <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider">
              {lokasiParam}
            </Badge>
          </div>
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

      {/* KPI Cards Grid (SPEC 9.6: Lima kartu dengan garis kiri 3px berwarna status) */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Total Produk Jadi */}
          <Card className="shadow-xs">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-medium text-muted-foreground">
                Total Produk Jadi
              </CardTitle>
              <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold tracking-tight text-foreground tabular-nums">
                {formatInt(data.cards.totalSku)} SKU
              </div>
              {data.cards.stockValue !== null && data.cards.stockValue !== undefined && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono tabular-nums">
                  Nilai: {formatRupiah(data.cards.stockValue)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 2. Aman (garis kiri 3px berwarna status per SPEC 9.6) */}
          <Card className="shadow-xs border-l-[3px] border-l-status-safe">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-medium text-status-safe">
                Aman
              </CardTitle>
              <ShieldCheck className="h-3.5 w-3.5 text-status-safe" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold tracking-tight text-status-safe tabular-nums">
                {formatInt(data.cards.safeCount)} SKU
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Stok di atas batas minimum
              </p>
            </CardContent>
          </Card>

          {/* 3. Minimal (garis kiri 3px berwarna status per SPEC 9.6) */}
          <Card className="shadow-xs border-l-[3px] border-l-status-minimum">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-medium text-status-minimum">
                Minimal
              </CardTitle>
              <AlertCircle className="h-3.5 w-3.5 text-status-minimum" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold tracking-tight text-status-minimum tabular-nums">
                {formatInt(data.cards.minimumCount)} SKU
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Mendekati safety stock
              </p>
            </CardContent>
          </Card>

          {/* 4. Kritis (garis kiri 3px berwarna status per SPEC 9.6) */}
          <Card className="shadow-xs border-l-[3px] border-l-status-critical">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-medium text-status-critical">
                Kritis
              </CardTitle>
              <AlertOctagon className="h-3.5 w-3.5 text-status-critical" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold tracking-tight text-status-critical tabular-nums">
                {formatInt(data.cards.criticalCount)} SKU
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Di bawah safety stock
              </p>
            </CardContent>
          </Card>

          {/* 5. Habis (garis kiri 3px berwarna status per SPEC 9.6) */}
          <Card className="shadow-xs border-l-[3px] border-l-status-empty">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-medium text-status-empty">
                Habis
              </CardTitle>
              <XCircle className="h-3.5 w-3.5 text-status-empty" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold tracking-tight text-status-empty tabular-nums">
                {formatInt(data.cards.emptyCount)} SKU
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Stok fisik 0 unit
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Tabs Filter & Table */}
      <Card className="shadow-xs overflow-hidden">
        <div className="p-3 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="overflow-x-auto pb-1 sm:pb-0">
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="ALL" className="text-xs px-3">Semua</TabsTrigger>
                <TabsTrigger value="SAFE" className="text-xs px-3">Aman</TabsTrigger>
                <TabsTrigger value="MINIMUM" className="text-xs px-3">Minimal</TabsTrigger>
                <TabsTrigger value="CRITICAL" className="text-xs px-3">Kritis</TabsTrigger>
                <TabsTrigger value="EMPTY" className="text-xs px-3">Habis</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

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
                <>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </>
              ) : !data?.rows.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">
                      Tidak ada persediaan barang ditemukan untuk kategori status ini.
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Ubah filter status atau periksa riwayat sinkronisasi data melalui menu Administrasi.
                    </p>
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
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground font-mono">
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
