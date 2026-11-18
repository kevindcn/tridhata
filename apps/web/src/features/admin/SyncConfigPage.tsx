import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Edit2,
  Save,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatInt, formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SheetMappingDto,
  SyncReport,
  SyncStatusResponse,
} from '@tridhata/shared';
import { toast } from 'sonner';

interface LocationItem {
  id: string;
  code: string;
  name: string;
}

export const SyncConfigPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasiParam = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';

  const [locationId, setLocationId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [mappings, setMappings] = useState<SheetMappingDto[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mapping Modal State
  const [editingMapping, setEditingMapping] = useState<SheetMappingDto | null>(null);
  const [editTab, setEditTab] = useState('');
  const [editHeader, setEditHeader] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);

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

  // Load status and mappings
  const loadStatus = () => {
    if (!locationId) return;
    setStatusLoading(true);
    setError(null);
    api<SyncStatusResponse>(`/sync/status?locationId=${locationId}`)
      .then((res) => {
        setSyncStatus(res);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Gagal memuat status sinkronisasi';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setStatusLoading(false);
      });
  };

  const loadMappings = () => {
    if (!locationId) return;
    setMappingsLoading(true);
    api<SheetMappingDto[]>(`/sync/mappings?locationId=${locationId}`)
      .then((res) => {
        setMappings(res);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Gagal memuat konfigurasi pemetaan';
        toast.error(msg);
      })
      .finally(() => {
        setMappingsLoading(false);
      });
  };

  useEffect(() => {
    loadStatus();
    loadMappings();
  }, [locationId]);

  // Trigger manual sync
  const handleTriggerSync = async () => {
    if (!locationId) return;
    setSyncing(true);
    try {
      const res = await api<{ status: string; report?: SyncReport }>('/sync/run', {
        method: 'POST',
        body: JSON.stringify({ locationId }),
      });

      if (res.status === 'SUCCESS') {
        toast.success('Sinkronisasi selesai dengan sukses');
      } else if (res.status === 'PARTIAL') {
        toast.warning('Sinkronisasi selesai sebagian (ada baris ditolak)');
      } else {
        toast.error('Sinkronisasi gagal. Periksa pemetaan dan format sheet');
      }

      loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menjalankan sinkronisasi';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (m: SheetMappingDto) => {
    setEditingMapping(m);
    setEditTab(m.tab);
    setEditHeader(m.sourceHeader);
  };

  // Save Mapping update
  const handleSaveMapping = async () => {
    if (!editingMapping || !locationId) return;
    setSavingMapping(true);
    try {
      const updatedList = mappings.map((m) =>
        m.id === editingMapping.id
          ? {
              ...m,
              tab: editTab.trim(),
              sourceHeader: editHeader.trim(),
            }
          : m,
      );

      await api('/sync/mappings', {
        method: 'PUT',
        body: JSON.stringify({
          locationId,
          mappings: updatedList.map((item) => ({
            id: item.id,
            entity: item.entity,
            tab: item.tab,
            sourceHeader: item.sourceHeader,
            targetField: item.targetField,
            fieldType: item.fieldType,
            required: item.required,
            isKey: item.isKey,
          })),
        }),
      });

      toast.success('Pemetaan berhasil diperbarui');
      setEditingMapping(null);
      loadMappings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pemetaan';
      toast.error(msg);
    } finally {
      setSavingMapping(false);
    }
  };

  // Collect all rejected rows from latest report
  const rejectedRowsList: Array<{
    entity: string;
    tab: string;
    row: number;
    field?: string;
    reason: string;
  }> = [];

  const latestReport = syncStatus?.lastRun?.report;
  if (latestReport?.entities) {
    for (const ent of latestReport.entities) {
      if (ent.rejectedRows) {
        for (const rej of ent.rejectedRows) {
          rejectedRowsList.push({
            entity: ent.entity,
            tab: ent.tab,
            row: rej.row,
            field: rej.field,
            reason: rej.reason,
          });
        }
      }
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <Badge variant="safe" className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Sukses
          </Badge>
        );
      case 'PARTIAL':
        return (
          <Badge variant="warning" className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Parsial
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="critical" className="inline-flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Gagal
          </Badge>
        );
      case 'RUNNING':
        return (
          <Badge variant="default" className="inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Berjalan
          </Badge>
        );
      default:
        return <Badge variant="outline">Belum Ada</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Sinkronisasi & Pemetaan — Pabrik {lokasiParam}
            </h1>
            <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider">
              {lokasiParam}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pengaturan pemetaan Google Sheets, pelacakan cron otomatis, dan trigger sinkronisasi manual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStatus}
            disabled={statusLoading}
            className="h-8 text-xs min-h-[36px] sm:min-h-[32px]"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${statusLoading ? 'animate-spin' : ''}`} />
            Segarkan Status
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleTriggerSync}
            disabled={syncing || statusLoading}
            className="h-8 text-xs min-h-[36px] sm:min-h-[32px]"
          >
            <Play className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Menyinkronkan...' : 'Jalankan Sekarang'}
          </Button>
        </div>
      </div>

      {/* Stale Warning Banner (SPEC 9.4 Poin 10) */}
      {syncStatus?.stale && (
        <div className="flex items-center gap-2 p-3 bg-warning-bg border border-warning/30 rounded-md text-warning text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span>
            Data terakhir diperbarui {syncStatus.lastSuccessAt ? formatDateTime(syncStatus.lastSuccessAt) : 'belum pernah'}. Angka di bawah mungkin belum mencerminkan kondisi terbaru.
          </span>
        </div>
      )}

      {/* Error State with Retry Button (SPEC 9.4 Poin 9) */}
      {error && !statusLoading && (
        <div className="p-8 text-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive shadow-xs">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => {
              loadStatus();
              loadMappings();
            }}
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Status Terakhir
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="mt-1">
              {getStatusBadge(syncStatus?.lastRun?.status)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Jadwal otomatis berjalan setiap jam (Asia/Jakarta)
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Waktu Sinkronisasi Terakhir
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xs font-semibold text-foreground tabular-nums mt-1 font-mono">
              {syncStatus?.lastRun?.startedAt ? formatDateTime(syncStatus.lastRun.startedAt) : 'Belum pernah'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
              Sukses terakhir: {syncStatus?.lastSuccessAt ? formatDateTime(syncStatus.lastSuccessAt) : 'Belum pernah'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Baris Diterima (Accepted)
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-status-safe" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold tracking-tight text-status-safe tabular-nums">
              {formatInt(syncStatus?.lastRun?.rowsAccepted || 0)} Baris
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Data berhasil divalidasi dan di-upsert ke database
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Baris Ditolak (Rejected)
            </CardTitle>
            <XCircle className="h-4 w-4 text-status-critical" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-xl font-bold tracking-tight tabular-nums ${
              (syncStatus?.lastRun?.rowsRejected || 0) > 0 ? 'text-status-critical' : 'text-foreground'
            }`}>
              {formatInt(syncStatus?.lastRun?.rowsRejected || 0)} Baris
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Baris gagal validasi (format salah / duplikasi)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sheet Mappings Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Pemetaan Kolom Google Sheets ({mappings.length} Kolom)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hubungkan nama tab dan teks header spreadsheet ke field database operasional.
            </p>
          </div>
        </CardHeader>

        <div className="border-t border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold">Entitas</TableHead>
                <TableHead className="text-xs font-semibold">Tab Sheet</TableHead>
                <TableHead className="text-xs font-semibold">Header di Spreadsheet</TableHead>
                <TableHead className="text-xs font-semibold">Field Database</TableHead>
                <TableHead className="text-xs font-semibold">Tipe</TableHead>
                <TableHead className="text-center text-xs font-semibold">Wajib</TableHead>
                <TableHead className="text-center text-xs font-semibold">Kunci Alami</TableHead>
                <TableHead className="text-right text-xs font-semibold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappingsLoading ? (
                <>
                  {[...Array(6)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-7 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </>
              ) : !mappings.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">
                      Belum ada konfigurasi pemetaan untuk lokasi ini.
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Konfigurasi otomatis dibuat saat inisialisasi awal pabrik.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-semibold text-foreground">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {m.entity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">
                      <span className={m.tab.includes('TODO_CONFIRM') ? 'text-warning font-mono text-[11px]' : ''}>
                        {m.tab}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">
                      <span className={m.sourceHeader.includes('TODO_CONFIRM') ? 'text-warning font-mono text-[11px]' : ''}>
                        {m.sourceHeader}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.targetField}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono">
                      {m.fieldType}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {m.required ? (
                        <span className="text-status-safe font-medium">Ya</span>
                      ) : (
                        <span className="text-muted-foreground">Opsional</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {m.isKey ? (
                        <span className="text-primary font-medium">Kunci</span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(m)}
                        className="h-7 text-xs px-2 text-primary hover:bg-muted"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Ubah
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Rejected Rows Log Card (Only visible if there are rejected rows) */}
      {rejectedRowsList.length > 0 && (
        <Card className="shadow-xs overflow-hidden border-status-critical/30">
          <CardHeader className="p-4 pb-3 bg-status-critical-bg/20 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-status-critical flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Laporan Baris Ditolak pada Sinkronisasi Terakhir ({rejectedRowsList.length} Baris)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Baris-baris ini dilewati secara anggun dan tidak memblokir baris valid lainnya.
              </p>
            </div>
          </CardHeader>
          <div className="border-t border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Entitas</TableHead>
                  <TableHead className="text-xs font-semibold">Tab Sheet</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Baris di Sheet</TableHead>
                  <TableHead className="text-xs font-semibold">Kolom/Field</TableHead>
                  <TableHead className="text-xs font-semibold">Alasan Penolakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejectedRowsList.map((rej, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-mono font-medium">
                      {rej.entity}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {rej.tab}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                      Baris {rej.row}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {rej.field || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-status-critical font-medium">
                      {rej.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Edit Mapping Modal */}
      <Dialog open={!!editingMapping} onOpenChange={(open) => !open && setEditingMapping(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Ubah Pemetaan Kolom ({editingMapping?.entity} - {editingMapping?.targetField})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nama Tab di Google Sheets</Label>
              <Input
                value={editTab}
                onChange={(e) => setEditTab(e.target.value)}
                placeholder="Contoh: Master Produk"
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Harus sama persis dengan nama tab di spreadsheet Google Sheets klien.
              </p>
            </div>

            <div>
              <Label className="text-xs">Teks Header Kolom</Label>
              <Input
                value={editHeader}
                onChange={(e) => setEditHeader(e.target.value)}
                placeholder="Contoh: Kode SKU"
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Teks pada baris header (pencocokan tidak case-sensitive dan mengabaikan spasi ganda).
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingMapping(null)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveMapping}
              disabled={savingMapping}
              className="text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {savingMapping ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
