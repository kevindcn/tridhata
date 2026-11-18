import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  Edit2,
  Check,
  Copy,
  AlertCircle,
  Loader2,
  MoreVertical,
  Shield,
  Building2,
} from 'lucide-react';
import {
  UserResponse,
  CreateUserDto,
  UpdateUserDto,
  RoleName,
} from '@tridhata/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/features/auth/AuthContext';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';

interface LocationOption {
  id: string;
  code: string;
  name: string;
}

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [tempPasswordModalOpen, setTempPasswordModalOpen] = useState(false);

  // Selected user and form data
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState<{
    name: string;
    email: string;
    role: RoleName;
    division: string;
    locationIds: string[];
  }>({
    name: '',
    email: '',
    role: 'STAFF',
    division: '',
    locationIds: [],
  });

  // Edit form state
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    role: RoleName;
    division: string;
    locationIds: string[];
    active: boolean;
  }>({
    name: '',
    email: '',
    role: 'STAFF',
    division: '',
    locationIds: [],
    active: true,
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api<UserResponse[]>('/users');
      setUsers(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.message || 'Gagal memuat daftar pengguna.');
      } else {
        setError('Terjadi kendala jaringan.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await api<LocationOption[]>('/locations');
      setLocations(data);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, [fetchUsers, fetchLocations]);

  // Handle open create dialog
  const handleOpenCreate = () => {
    setCreateForm({
      name: '',
      email: '',
      role: 'STAFF',
      division: '',
      locationIds: locations.length > 0 ? [locations[0].id] : [],
    });
    setFormError(null);
    setCreateDialogOpen(true);
  };

  // Submit Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    if (createForm.locationIds.length === 0) {
      setFormError('Pilih minimal satu lokasi akses.');
      setFormSubmitting(false);
      return;
    }

    try {
      const payload: CreateUserDto = {
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        role: createForm.role,
        division: createForm.division.trim() || undefined,
        locationIds: createForm.locationIds,
      };

      const res = await api<{ user: UserResponse; temporaryPassword: string }>(
        '/users',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setCreateDialogOpen(false);
      setGeneratedPassword(res.temporaryPassword);
      setTempPasswordModalOpen(true);
      toast.success('Pengguna berhasil ditambahkan.');
      await fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.body?.message || 'Gagal menambahkan pengguna.');
      } else {
        setFormError('Terjadi kesalahan sistem.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle open edit dialog
  const handleOpenEdit = (user: UserResponse) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      division: user.division || '',
      locationIds: user.locations.map((l) => l.id),
      active: user.active,
    });
    setFormError(null);
    setEditDialogOpen(true);
  };

  // Submit Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload: UpdateUserDto = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        division: editForm.division.trim() || undefined,
        locationIds: editForm.locationIds,
        active: editForm.active,
      };

      await api(`/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setEditDialogOpen(false);
      toast.success('Data pengguna berhasil diperbarui.');
      await fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.body?.message || 'Gagal memperbarui pengguna.');
      } else {
        setFormError('Terjadi kesalahan sistem.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle open reset password dialog
  const handleOpenReset = (user: UserResponse) => {
    setSelectedUser(user);
    setResetDialogOpen(true);
  };

  // Submit Reset Password
  const handleResetSubmit = async () => {
    if (!selectedUser) return;
    setFormSubmitting(true);

    try {
      const res = await api<{ temporaryPassword: string }>(
        `/users/${selectedUser.id}/reset-password`,
        {
          method: 'POST',
        },
      );

      setResetDialogOpen(false);
      setGeneratedPassword(res.temporaryPassword);
      setTempPasswordModalOpen(true);
      toast.success('Kata sandi berhasil diatur ulang.');
      await fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.body?.message || 'Gagal mengatur ulang kata sandi.');
      } else {
        toast.error('Terjadi kesalahan sistem.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    toast.success('Kata sandi disalin ke papan klip.');
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleLocationSelection = (locId: string, formType: 'create' | 'edit') => {
    if (formType === 'create') {
      setCreateForm((prev) => {
        const exists = prev.locationIds.includes(locId);
        return {
          ...prev,
          locationIds: exists
            ? prev.locationIds.filter((id) => id !== locId)
            : [...prev.locationIds, locId],
        };
      });
    } else {
      setEditForm((prev) => {
        const exists = prev.locationIds.includes(locId);
        return {
          ...prev,
          locationIds: exists
            ? prev.locationIds.filter((id) => id !== locId)
            : [...prev.locationIds, locId],
        };
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Manajemen Pengguna
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola akun, peran otorisasi, dan hak akses fasilitas operasional pabrik.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="h-9 gap-2 text-xs">
          <UserPlus className="h-4 w-4" />
          Tambah Pengguna
        </Button>
      </div>

      {/* Main Table Card */}
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
              onClick={fetchUsers}
            >
              Coba Lagi
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Belum ada pengguna terdaftar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tambahkan pengguna baru untuk memberikan akses ke sistem.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Nama & Email</TableHead>
                  <TableHead className="w-[120px]">Peran</TableHead>
                  <TableHead className="w-[140px]">Divisi</TableHead>
                  <TableHead>Akses Fasilitas</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {user.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === 'ADMIN'
                            ? 'default'
                            : user.role === 'FINANCE'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="text-[11px]"
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.division || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.locations.map((loc) => (
                          <Badge
                            key={loc.id}
                            variant="outline"
                            className="text-[10px] bg-muted/30"
                          >
                            {loc.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-status-safe">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-safe" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                          Nonaktif
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Menu Opsi</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => handleOpenEdit(user)}
                            className="text-xs cursor-pointer gap-2"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Ubah Data
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleOpenReset(user)}
                            className="text-xs cursor-pointer gap-2 text-warning focus:text-warning"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Atur Ulang Sandi
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialog Tambah Pengguna */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Tambah Pengguna Baru
              </DialogTitle>
              <DialogDescription className="text-xs">
                Kata sandi sementara 12 karakter akan dibuat secara otomatis dan ditampilkan sekali.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid gap-3 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-name" className="text-xs">
                  Nama Lengkap
                </Label>
                <Input
                  id="create-name"
                  placeholder="e.g. Budi Santoso"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-email" className="text-xs">
                  Email Perusahaan
                </Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="budi@tridhata.com"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-role" className="text-xs">
                    Peran
                  </Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(val: RoleName) =>
                      setCreateForm({ ...createForm, role: val })
                    }
                  >
                    <SelectTrigger id="create-role" className="text-xs">
                      <SelectValue placeholder="Pilih Peran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                      <SelectItem value="FINANCE">FINANCE</SelectItem>
                      <SelectItem value="STAFF">STAFF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-division" className="text-xs">
                    Divisi (Opsional)
                  </Label>
                  <Input
                    id="create-division"
                    placeholder="PPIC / Gudang"
                    value={createForm.division}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, division: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs">Akses Fasilitas Pabrik</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {locations.map((loc) => {
                    const isSelected = createForm.locationIds.includes(loc.id);
                    return (
                      <button
                        type="button"
                        key={loc.id}
                        onClick={() =>
                          toggleLocationSelection(loc.id, 'create')
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        {loc.name}
                        {isSelected && <Check className="h-3.5 w-3.5 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={formSubmitting}>
                {formSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Buat Akun
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Ubah Pengguna */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Ubah Data Pengguna
              </DialogTitle>
              <DialogDescription className="text-xs">
                Perbarui data profil, peran, atau status aktif pengguna.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid gap-3 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs">
                  Nama Lengkap
                </Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className="text-xs">
                  Email Perusahaan
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-role" className="text-xs">
                    Peran
                  </Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(val: RoleName) =>
                      setEditForm({ ...editForm, role: val })
                    }
                    disabled={selectedUser?.id === currentUser?.id}
                  >
                    <SelectTrigger id="edit-role" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                      <SelectItem value="FINANCE">FINANCE</SelectItem>
                      <SelectItem value="STAFF">STAFF</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedUser?.id === currentUser?.id && (
                    <p className="text-[10px] text-muted-foreground">
                      Tidak dapat mengubah peran sendiri
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-division" className="text-xs">
                    Divisi
                  </Label>
                  <Input
                    id="edit-division"
                    value={editForm.division}
                    onChange={(e) =>
                      setEditForm({ ...editForm, division: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs">Akses Fasilitas Pabrik</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {locations.map((loc) => {
                    const isSelected = editForm.locationIds.includes(loc.id);
                    return (
                      <button
                        type="button"
                        key={loc.id}
                        onClick={() => toggleLocationSelection(loc.id, 'edit')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        {loc.name}
                        {isSelected && <Check className="h-3.5 w-3.5 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    disabled={selectedUser?.id === currentUser?.id}
                    onChange={(e) =>
                      setEditForm({ ...editForm, active: e.target.checked })
                    }
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Akun Aktif</span>
                </label>
                {selectedUser?.id === currentUser?.id && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Tidak dapat menonaktifkan akun sendiri
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={formSubmitting}>
                {formSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Reset Password */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Atur Ulang Kata Sandi
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sistem akan menghasilkan kata sandi sementara baru untuk{' '}
              <strong>{selectedUser?.name}</strong>. Seluruh sesi aktif pengguna ini akan otomatis dicabut.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleResetSubmit}
              disabled={formSubmitting}
            >
              {formSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Ya, Atur Ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Kata Sandi Sementara (One-time Display) */}
      <Dialog
        open={tempPasswordModalOpen}
        onOpenChange={setTempPasswordModalOpen}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-safe-bg text-status-safe mb-2">
              <Shield className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Kata Sandi Sementara
            </DialogTitle>
            <DialogDescription className="text-xs">
              Salin dan berikan kata sandi ini kepada pengguna. Kata sandi ini hanya ditampilkan sekarang.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
            <code className="text-base font-mono font-semibold tracking-wider text-foreground select-all">
              {generatedPassword}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopyPassword}
            >
              {copied ? (
                <Check className="h-4 w-4 text-status-safe" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="w-full text-xs"
              onClick={() => setTempPasswordModalOpen(false)}
            >
              Selesai & Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
