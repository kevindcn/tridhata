import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileCheck2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  FileText,
  User,
  Calendar,
  DollarSign,
  Info,
} from 'lucide-react';
import { RequestItem, CreateRequestDto, DecideRequestDto } from '@tridhata/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/features/auth/AuthContext';
import { formatRupiah, formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from '@/components/ui/sonner';

interface LocationItem {
  id: string;
  code: string;
  name: string;
}

type TabKey = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const PREDEFINED_TYPES = [
  'Diskon Khusus',
  'Diskon Volume',
  'Klaim Retur',
  'Penyesuaian Harga',
  'Kompensasi Operasional',
  'Lainnya',
];

export const ApprovalsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lokasiParam = searchParams.get('lokasi')?.toUpperCase() || 'BOGOR';
  const { user, hasPermission } = useAuth();

  const [_locations, setLocations] = useState<LocationItem[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING');

  // Sheet detail state
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Create Request Modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<{
    type: string;
    customType: string;
    title: string;
    amount: string;
    note: string;
  }>({
    type: 'Diskon Khusus',
    customType: '',
    title: '',
    amount: '',
    note: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Decide modals state
  const [decideTarget, setDecideTarget] = useState<RequestItem | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);
  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);
  const [rejectNote, setRejectNote] = useState<string>('');
  const [rejectError, setRejectError] = useState<string>('');
  const [isDeciding, setIsDeciding] = useState<boolean>(false);

  const canDecide = hasPermission('approval:decide');
  const canCreate = hasPermission('approval:create');

  // Load locations
  useEffect(() => {
    let mounted = true;
    api<LocationItem[]>('/locations')
      .then((locs) => {
        if (!mounted) return;
        setLocations(locs);
        const match = locs.find(
          (l) =>
            l.code.toUpperCase() === lokasiParam ||
            l.name.toUpperCase().includes(lokasiParam),
        );
        if (match) {
          setActiveLocationId(match.id);
        } else if (locs.length > 0) {
          setActiveLocationId(locs[0].id);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Gagal memuat lokasi';
        toast.error(msg);
      });
    return () => {
      mounted = false;
    };
  }, [lokasiParam]);

  // Load requests
  const loadRequests = useCallback(async () => {
    if (!activeLocationId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api<RequestItem[]>(`/approvals?locationId=${activeLocationId}`);
      setRequests(data);
      // Update selectedRequest if open
      if (selectedRequest) {
        const updated = data.find((r) => r.id === selectedRequest.id);
        if (updated) setSelectedRequest(updated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Data pengajuan gagal dimuat. Periksa koneksi, lalu coba lagi.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeLocationId, selectedRequest]);

  useEffect(() => {
    loadRequests();
  }, [activeLocationId]);

  // Counts for tabs
  const counts = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return {
      PENDING: pending,
      APPROVED: approved,
      REJECTED: rejected,
      ALL: requests.length,
    };
  }, [requests]);

  // Filtered requests by active tab
  const filteredRequests = useMemo(() => {
    if (activeTab === 'ALL') return requests;
    return requests.filter((r) => r.status === activeTab);
  }, [requests, activeTab]);

  // Handle open detail sheet
  const handleOpenDetail = (req: RequestItem) => {
    setSelectedRequest(req);
    setIsDetailOpen(true);
  };

  // Validate Create Request
  const validateCreate = (): boolean => {
    const errors: Record<string, string> = {};
    const finalType = createForm.type === 'Lainnya' ? createForm.customType.trim() : createForm.type;

    if (!finalType) {
      errors.type = 'Jenis pengajuan wajib diisi';
    }
    if (!createForm.title || createForm.title.trim().length < 3) {
      errors.title = 'Judul minimal 3 karakter';
    } else if (createForm.title.length > 120) {
      errors.title = 'Judul maksimal 120 karakter';
    }

    const parsedAmount = Number(createForm.amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      errors.amount = 'Nilai pengajuan harus berupa angka positif';
    }

    if (createForm.note && createForm.note.length > 1000) {
      errors.note = 'Catatan maksimal 1000 karakter';
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create Request
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreate() || !activeLocationId) return;

    setIsSubmittingCreate(true);
    try {
      const finalType = createForm.type === 'Lainnya' ? createForm.customType.trim() : createForm.type;
      const payload: CreateRequestDto = {
        locationId: activeLocationId,
        type: finalType,
        title: createForm.title.trim(),
        amount: Number(createForm.amount),
        note: createForm.note.trim() ? createForm.note.trim() : undefined,
      };

      await api<RequestItem>('/approvals', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Pengajuan berhasil dibuat');
      setIsCreateOpen(false);
      setCreateForm({
        type: 'Diskon Khusus',
        customType: '',
        title: '',
        amount: '',
        note: '',
      });
      setCreateErrors({});
      await loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Gagal membuat pengajuan';
      toast.error(msg);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Approve Confirmation
  const promptApprove = (req: RequestItem) => {
    setDecideTarget(req);
    setIsApproveOpen(true);
  };

  // Execute Approve Decision
  const handleApprove = async () => {
    if (!decideTarget) return;

    setIsDeciding(true);
    try {
      const payload: DecideRequestDto = {
        decision: 'APPROVED',
      };
      await api<RequestItem>(`/approvals/${decideTarget.id}/decide`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Pengajuan berhasil disetujui');
      setIsApproveOpen(false);
      setDecideTarget(null);
      await loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Gagal menyetujui pengajuan';
      toast.error(msg);
    } finally {
      setIsDeciding(false);
    }
  };

  // Open Reject Dialog
  const promptReject = (req: RequestItem) => {
    setDecideTarget(req);
    setRejectNote('');
    setRejectError('');
    setIsRejectOpen(true);
  };

  // Execute Reject Decision
  const handleReject = async () => {
    if (!decideTarget) return;

    if (!rejectNote || rejectNote.trim().length < 5) {
      setRejectError('Alasan penolakan wajib diisi (minimal 5 karakter)');
      return;
    }

    setIsDeciding(true);
    try {
      const payload: DecideRequestDto = {
        decision: 'REJECTED',
        note: rejectNote.trim(),
      };
      await api<RequestItem>(`/approvals/${decideTarget.id}/decide`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Pengajuan telah ditolak');
      setIsRejectOpen(false);
      setDecideTarget(null);
      await loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Gagal menolak pengajuan';
      toast.error(msg);
    } finally {
      setIsDeciding(false);
    }
  };

  // Render Status Badge using Design Tokens
  const renderStatusBadge = (status: RequestItem['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="font-medium inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Menunggu
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge variant="safe" className="font-medium inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Disetujui
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="critical" className="font-medium inline-flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Ditolak
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Persetujuan Operasional
            </h1>
            <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider">
              {lokasiParam}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daftar dan alur persetujuan pengajuan diskon atau penyesuaian operasional.
          </p>
        </div>

        {canCreate && (
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Buat Pengajuan
          </Button>
        )}
      </div>

      {/* Tabs Filter Bar (Scrollable for mobile 360px) */}
      <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('PENDING')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
            activeTab === 'PENDING'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Menunggu</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'PENDING'
                ? 'bg-status-minimum-bg text-status-minimum font-semibold'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {counts.PENDING}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('APPROVED')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
            activeTab === 'APPROVED'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Disetujui</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'APPROVED'
                ? 'bg-status-safe-bg text-status-safe font-semibold'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {counts.APPROVED}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REJECTED')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
            activeTab === 'REJECTED'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Ditolak</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'REJECTED'
                ? 'bg-status-critical-bg text-status-critical font-semibold'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {counts.REJECTED}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
            activeTab === 'ALL'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Semua</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground">
            {counts.ALL}
          </span>
        </button>
      </div>

      {/* Error State with Retry Button (SPEC 9.4 Poin 9) */}
      {error && !isLoading && (
        <div className="p-8 text-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive shadow-xs">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={loadRequests}
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-foreground">
              Belum ada pengajuan pada tab ini
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              Pengajuan baru yang dibuat oleh staf akan muncul di tab Menunggu untuk ditinjau oleh bagian Keuangan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px] text-xs">Tanggal</TableHead>
                  <TableHead className="w-[180px] text-xs">Pemohon</TableHead>
                  <TableHead className="w-[140px] text-xs">Jenis</TableHead>
                  <TableHead className="text-xs">Judul Pengajuan</TableHead>
                  <TableHead className="w-[140px] text-right text-xs">Nilai</TableHead>
                  <TableHead className="w-[120px] text-center text-xs">Status</TableHead>
                  <TableHead className="w-[150px] text-right text-xs">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const isOwner = req.requesterId === user?.id;
                  const canDecideThis = canDecide && !isOwner && req.status === 'PENDING';

                  return (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => handleOpenDetail(req)}
                    >
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {formatDateTime(req.createdAt)}
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-medium text-foreground leading-tight">
                          {req.requester.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[170px]">
                          {req.requester.email}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {req.type}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-medium text-foreground line-clamp-1">
                          {req.title}
                        </div>
                        {req.note && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {req.note}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-xs font-mono tabular-nums font-semibold text-foreground">
                        {formatRupiah(req.amount)}
                      </TableCell>

                      <TableCell className="text-center">
                        {renderStatusBadge(req.status)}
                      </TableCell>

                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {canDecideThis ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-status-safe/40 text-status-safe hover:bg-status-safe-bg"
                                onClick={() => promptApprove(req)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Setujui
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-status-critical/40 text-status-critical hover:bg-status-critical-bg"
                                onClick={() => promptReject(req)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Tolak
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenDetail(req)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Detail
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Side Sheet: Detail Pengajuan */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selectedRequest && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {selectedRequest.type}
                  </span>
                  {renderStatusBadge(selectedRequest.status)}
                </div>
                <SheetTitle className="text-base font-semibold leading-tight text-foreground">
                  {selectedRequest.title}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  ID: <span className="font-mono text-[11px]">{selectedRequest.id}</span>
                </SheetDescription>
              </SheetHeader>

              {/* Informational Cards */}
              <div className="space-y-4 text-xs">
                {/* Nilai Pengajuan */}
                <div className="p-3.5 rounded-lg border border-border bg-muted/30">
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Nilai Pengajuan
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-foreground">
                    {formatRupiah(selectedRequest.amount)}
                  </div>
                </div>

                {/* Pemohon Info */}
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wider flex items-center gap-1.5 font-medium">
                    <User className="h-3.5 w-3.5" />
                    Informasi Pemohon
                  </div>
                  <div className="text-foreground font-medium">
                    {selectedRequest.requester.name}
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    {selectedRequest.requester.email}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] pt-1 border-t border-border">
                    <Calendar className="h-3.5 w-3.5" />
                    Diajukan pada {formatDateTime(selectedRequest.createdAt)}
                  </div>
                </div>

                {/* Catatan Pemohon */}
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-1.5">
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Catatan Pengajuan
                  </div>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedRequest.note || 'Tidak ada catatan tambahan.'}
                  </p>
                </div>

                {/* Riwayat Keputusan */}
                {selectedRequest.approvals && selectedRequest.approvals.length > 0 && (
                  <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                    <div className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium flex items-center gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      Riwayat Keputusan
                    </div>
                    {selectedRequest.approvals.map((app) => (
                      <div key={app.id} className="space-y-1.5 pt-2 border-t border-border first:pt-0 first:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{app.approver.name}</span>
                          {renderStatusBadge(app.decision)}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          Diputuskan pada {formatDateTime(app.decidedAt)}
                        </div>
                        {app.note && (
                          <div className="mt-1 p-2 rounded bg-status-critical-bg border border-status-critical/30 text-status-critical text-xs">
                            <span className="font-semibold block mb-0.5">Alasan Penolakan:</span>
                            {app.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Self-approval Warning if requester is viewer */}
                {selectedRequest.status === 'PENDING' && selectedRequest.requesterId === user?.id && (
                  <div className="p-3 rounded-lg border border-warning/30 bg-warning-bg text-warning text-xs flex items-start gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium block">Pemisahan Tugas:</span>
                      Anda adalah pemohon pengajuan ini. Sesuai aturan SPEC, Anda tidak dapat memutuskan pengajuan Anda sendiri.
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons in Sheet */}
              {selectedRequest.status === 'PENDING' && canDecide && selectedRequest.requesterId !== user?.id && (
                <div className="pt-4 border-t border-border flex items-center gap-2">
                  <Button
                    className="flex-1 bg-status-safe hover:bg-status-safe/90 text-primary-foreground"
                    onClick={() => {
                      promptApprove(selectedRequest);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Setujui
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      promptReject(selectedRequest);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Tolak
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog: Buat Pengajuan */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmitCreate}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Buat Pengajuan Baru
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Kirim pengajuan diskon atau penyesuaian operasional untuk disetujui bagian Keuangan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Jenis Pengajuan */}
              <div className="space-y-1.5">
                <Label htmlFor="req-type" className="text-xs">
                  Jenis Pengajuan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={createForm.type}
                  onValueChange={(val) => setCreateForm({ ...createForm, type: val })}
                >
                  <SelectTrigger id="req-type" className="text-xs">
                    <SelectValue placeholder="Pilih jenis pengajuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {createForm.type === 'Lainnya' && (
                  <Input
                    placeholder="Tuliskan jenis pengajuan..."
                    value={createForm.customType}
                    onChange={(e) => setCreateForm({ ...createForm, customType: e.target.value })}
                    className="mt-2 text-xs"
                  />
                )}
                {createErrors.type && (
                  <p className="text-[11px] text-destructive">{createErrors.type}</p>
                )}
              </div>

              {/* Judul Pengajuan */}
              <div className="space-y-1.5">
                <Label htmlFor="req-title" className="text-xs">
                  Judul Pengajuan <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="req-title"
                  placeholder="Misal: Diskon volume order PT Maju Bersama"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="text-xs"
                />
                {createErrors.title && (
                  <p className="text-[11px] text-destructive">{createErrors.title}</p>
                )}
              </div>

              {/* Nilai Pengajuan */}
              <div className="space-y-1.5">
                <Label htmlFor="req-amount" className="text-xs">
                  Nilai Pengajuan (Rp) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="req-amount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  className="text-xs font-mono"
                />
                {createErrors.amount && (
                  <p className="text-[11px] text-destructive">{createErrors.amount}</p>
                )}
              </div>

              {/* Catatan / Keterangan */}
              <div className="space-y-1.5">
                <Label htmlFor="req-note" className="text-xs">
                  Catatan Tambahan (Opsional)
                </Label>
                <Textarea
                  id="req-note"
                  rows={3}
                  placeholder="Jelaskan justifikasi atau rincian tambahan..."
                  value={createForm.note}
                  onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                  className="text-xs"
                />
                {createErrors.note && (
                  <p className="text-[11px] text-destructive">{createErrors.note}</p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmittingCreate}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingCreate}
                className="inline-flex items-center gap-1.5"
              >
                {isSubmittingCreate && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Kirim Pengajuan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Konfirmasi Setujui */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-status-safe" />
              Setujui Pengajuan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui pengajuan{' '}
              <strong className="text-foreground font-medium">"{decideTarget?.title}"</strong>{' '}
              senilai{' '}
              <strong className="text-foreground font-medium">
                {decideTarget ? formatRupiah(decideTarget.amount) : ''}
              </strong>
              ? Keputusan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsApproveOpen(false)}
              disabled={isDeciding}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApprove}
              disabled={isDeciding}
              className="bg-status-safe hover:bg-status-safe/90 text-primary-foreground inline-flex items-center gap-1.5"
            >
              {isDeciding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Setujui Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Konfirmasi Tolak (Alasan Wajib min 5 karakter) */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Tolak Pengajuan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Masukkan alasan penolakan untuk pengajuan{' '}
              <strong className="text-foreground font-medium">"{decideTarget?.title}"</strong>.
              Alasan ini wajib dan akan tercatat pada log riwayat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3 text-xs">
            <Label htmlFor="reject-reason" className="text-xs font-medium">
              Alasan Penolakan <span className="text-destructive">* (min. 5 karakter)</span>
            </Label>
            <Textarea
              id="reject-reason"
              rows={3}
              placeholder="Contoh: Diskon melebihi batas margin operasional pabrik..."
              value={rejectNote}
              onChange={(e) => {
                setRejectNote(e.target.value);
                if (e.target.value.trim().length >= 5) setRejectError('');
              }}
              className="text-xs"
            />
            {rejectError && <p className="text-[11px] text-destructive">{rejectError}</p>}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRejectOpen(false)}
              disabled={isDeciding}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={isDeciding || rejectNote.trim().length < 5}
              className="inline-flex items-center gap-1.5"
            >
              {isDeciding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Tolak Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
