import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  RotateCcw,
  AlertCircle,
  Loader2,
  User,
  Clock,
  Globe,
  FileJson,
} from 'lucide-react';
import { AuditLogItem, AuditLogResponse } from '@tridhata/shared';
import { api, ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [fromFilter, setFromFilter] = useState<string>('');
  const [toFilter, setToFilter] = useState<string>('');

  // Selected log for side sheet
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const query = new URLSearchParams();
        if (actionFilter && actionFilter !== 'all') {
          query.set('action', actionFilter);
        }
        if (fromFilter) {
          query.set('from', fromFilter);
        }
        if (toFilter) {
          query.set('to', toFilter);
        }
        if (cursor) {
          query.set('cursor', cursor);
        }
        query.set('limit', '30');

        const res = await api<AuditLogResponse>(`/audit-logs?${query.toString()}`);

        if (cursor) {
          setLogs((prev) => [...prev, ...res.items]);
        } else {
          setLogs(res.items);
        }
        setNextCursor(res.nextCursor);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.body?.message || 'Gagal memuat log audit.');
        } else {
          setError('Terjadi kendala jaringan.');
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [actionFilter, fromFilter, toFilter],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleResetFilter = () => {
    setActionFilter('all');
    setFromFilter('');
    setToFilter('');
  };

  const handleRowClick = (log: AuditLogItem) => {
    setSelectedLog(log);
    setSheetOpen(true);
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.startsWith('user.created')) return 'default';
    if (action.startsWith('user.updated')) return 'secondary';
    if (action.includes('reset') || action.includes('revoked')) return 'destructive';
    return 'outline';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Log Audit Sistem
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Rekam jejak seluruh mutasi data, pembuatan akun, dan aksi administratif dengan stempel waktu Asia/Jakarta.
        </p>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleApplyFilter}
        className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-lg border border-border bg-card shadow-xs items-end"
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Jenis Aksi</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="Semua Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              <SelectItem value="user.created">user.created</SelectItem>
              <SelectItem value="user.updated">user.updated</SelectItem>
              <SelectItem value="user.password_reset">user.password_reset</SelectItem>
              <SelectItem value="auth.login">auth.login</SelectItem>
              <SelectItem value="auth.logout">auth.logout</SelectItem>
              <SelectItem value="auth.password_changed">auth.password_changed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Dari Tanggal</Label>
          <Input
            type="date"
            className="h-8 text-xs bg-card"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Sampai Tanggal</Label>
          <Input
            type="date"
            className="h-8 text-xs bg-card"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" className="h-8 text-xs flex-1 gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Terapkan
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={handleResetFilter}
            title="Reset Filter"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>

      {/* Audit Log Table */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs"
              onClick={() => fetchLogs()}
            >
              Coba Lagi
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Tidak ada catatan log audit
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Catatan aktivitas akan muncul di sini setelah aksi administratif atau otentikasi dilakukan.
            </p>
          </div>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Waktu (WIB)</TableHead>
                  <TableHead className="w-[200px]">Pelaku</TableHead>
                  <TableHead className="w-[160px]">Aksi</TableHead>
                  <TableHead className="w-[140px]">Entitas</TableHead>
                  <TableHead>Alamat IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    onClick={() => handleRowClick(log)}
                    className="cursor-pointer"
                  >
                    <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-xs text-foreground">
                          {log.actorName || 'Sistem'}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {log.actorId ? log.actorId.slice(0, 8) + '...' : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getActionBadgeVariant(log.action)}
                        className="text-[11px] font-mono"
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {log.entity} {log.entityId ? `(${log.entityId.slice(0, 8)})` : ''}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {log.ip || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {nextCursor && (
              <div className="p-4 border-t border-border flex justify-center bg-muted/20">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-2"
                  onClick={() => fetchLogs(nextCursor)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Muat Lebih Banyak
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Side Sheet Detail Log */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="text-base font-semibold flex items-center gap-2">
              <FileJson className="h-4 w-4 text-primary" />
              Detail Log Audit
            </SheetTitle>
            <SheetDescription className="text-xs">
              Informasi lengkap peristiwa mutasi data
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="space-y-5 py-4 text-xs">
              {/* Metadata Box */}
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Waktu
                  </span>
                  <span className="font-mono tabular-nums font-medium">
                    {formatDateTime(selectedLog.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Aksi
                  </span>
                  <Badge variant={getActionBadgeVariant(selectedLog.action)} className="text-[10px]">
                    {selectedLog.action}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Pelaku
                  </span>
                  <span className="font-medium text-foreground">
                    {selectedLog.actorName || selectedLog.actorId || 'Sistem'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    IP & Klien
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {selectedLog.ip || '-'}
                  </span>
                </div>
              </div>

              {/* JSON Before & After */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Sebelum (Before)
                  </Label>
                  <pre className="mt-1.5 p-3 rounded-md bg-muted text-[11px] font-mono overflow-x-auto border border-border text-foreground leading-relaxed max-h-48">
                    {selectedLog.before
                      ? JSON.stringify(selectedLog.before, null, 2)
                      : '<Tidak ada data sebelum / baru dibuat>'}
                  </pre>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Sesudah (After)
                  </Label>
                  <pre className="mt-1.5 p-3 rounded-md bg-muted text-[11px] font-mono overflow-x-auto border border-border text-foreground leading-relaxed max-h-48">
                    {selectedLog.after
                      ? JSON.stringify(selectedLog.after, null, 2)
                      : '<Tidak ada data sesudah>'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
