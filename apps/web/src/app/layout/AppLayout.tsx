import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Factory,
  Boxes,
  FileCheck2,
  Users,
  ShieldAlert,
  RefreshCw,
  LogOut,
  KeyRound,
  Menu,
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MapPinned,
  Truck,
  Sparkles,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Permission, SyncStatusResponse } from '@tridhata/shared';
import { toast } from 'sonner';

interface LocationItem {
  id: string;
  code: string;
  name: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'EKSEKUTIF & DASHBOARD',
    items: [
      {
        label: 'Ringkasan Penjualan',
        path: '/penjualan',
        icon: TrendingUp,
        permission: 'dashboard:sales',
      },
      {
        label: 'Rencana Produksi',
        path: '/produksi',
        icon: Factory,
        permission: 'dashboard:production',
      },
      {
        label: 'Status Persediaan',
        path: '/persediaan',
        icon: Boxes,
        permission: 'dashboard:inventory',
      },
    ],
  },
  {
    groupName: 'OPERASIONAL LAPANGAN',
    items: [
      {
        label: 'Kunjungan & Foto Lapang',
        path: '/lapangan',
        icon: MapPinned,
        permission: 'field:activity',
      },
    ],
  },
  {
    groupName: 'GUDANG & LOGISTIK',
    items: [
      {
        label: 'Penerimaan & Surat Jalan',
        path: '/gudang',
        icon: Truck,
        permission: 'warehouse:ops',
      },
    ],
  },
  {
    groupName: 'KEUANGAN & PERSETUJUAN',
    items: [
      {
        label: 'Alur Pengajuan & ACC',
        path: '/persetujuan',
        icon: FileCheck2,
        permission: 'approval:create',
      },
    ],
  },
  {
    groupName: 'ADMINISTRASI',
    items: [
      {
        label: 'Manajemen Pengguna',
        path: '/admin/pengguna',
        icon: Users,
        permission: 'user:manage',
      },
      {
        label: 'Log Audit',
        path: '/admin/log',
        icon: ShieldAlert,
        permission: 'audit:read',
      },
      {
        label: 'Sinkronisasi Sheets',
        path: '/admin/sinkron',
        icon: RefreshCw,
        permission: 'sync:manage',
      },
    ],
  },
];

const DEMO_ACCOUNTS = [
  {
    role: 'OWNER',
    email: 'owner@tridhata.com',
    name: 'Ir. Hendra Wijaya',
    title: 'Owner & Direktur Utama',
    badge: '👑 Owner / Direktur',
    desc: 'Laporan omzet, target pabrik, dan hak ACC tertinggi',
  },
  {
    role: 'FINANCE',
    email: 'budi@tridhata.com',
    name: 'Budi Santoso',
    title: 'Finance & Accounting',
    badge: '💼 Finance & Kasir',
    desc: 'Omzet Rp, ajukan kasbon/PO ke Owner, ACC diskon sales',
  },
  {
    role: 'SALES_OFFICE',
    email: 'sales@tridhata.com',
    name: 'Rian Pratama',
    title: 'Sales Marketing Kantor',
    badge: '📊 Sales Marketing',
    desc: 'Volume Pcs, tanpa rahasia omzet Rp, buat ajuan diskon',
  },
  {
    role: 'SALES_FIELD',
    email: 'agronomis@tridhata.com',
    name: 'Agus Santoso, S.P.',
    title: 'Sales Lapang & Agronomis',
    badge: '🌾 Sales Lapang',
    desc: 'Check-in kios/petani, pantau demplot, unggah foto',
  },
  {
    role: 'WAREHOUSE',
    email: 'gudang@tridhata.com',
    name: 'Joko Widodo',
    title: 'Staf Gudang & Logistik PIC',
    badge: '📦 Gudang & Logistik',
    desc: 'Penerimaan fisik barang, bukti SJ vendor, cetak SJ PDF',
  },
  {
    role: 'ADMIN',
    email: 'admin@tridhata.com',
    name: 'Administrator Utama',
    title: 'IT & System Admin',
    badge: '⚙️ Administrator',
    desc: 'Kelola pengguna, log audit, dan pemetaan Sheets',
  },
];

export const AppLayout: React.FC = () => {
  const { user, login, logout, hasPermission } = useAuth();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentLocation = searchParams.get('lokasi');
  const activeLocation = locations.find(
    (l) => l.code.toLowerCase() === (currentLocation || '').toLowerCase(),
  ) || locations[0];

  useEffect(() => {
    if (!activeLocation?.id) return;
    let isMounted = true;

    const poll = () => {
      api<SyncStatusResponse>(`/sync/status?locationId=${activeLocation.id}`)
        .then((res) => {
          if (isMounted) setSyncStatus(res);
        })
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeLocation?.id]);

  useEffect(() => {
    let isMounted = true;
    api<LocationItem[]>('/locations')
      .then((data) => {
        if (!isMounted) return;
        setLocations(data);
        if (!searchParams.get('lokasi') && data.length > 0) {
          const defaultLoc = user?.defaultLocationId
            ? data.find((l) => l.id === user.defaultLocationId) || data[0]
            : data[0];
          setSearchParams(
            (prev) => {
              prev.set('lokasi', defaultLoc.code.toLowerCase());
              return prev;
            },
            { replace: true },
          );
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.defaultLocationId, searchParams, setSearchParams]);

  const handleLocationChange = (value: string) => {
    setSearchParams(
      (prev) => {
        prev.set('lokasi', value);
        return prev;
      },
      { replace: true },
    );
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSwitchDemoAccount = async (acc: (typeof DEMO_ACCOUNTS)[0]) => {
    try {
      await login({ email: acc.email, password: 'AdminTridhata2026!' });
      toast.success(`Beralih peran: ${acc.title}`);
      if (acc.role === 'SALES_FIELD') {
        navigate(`/lapangan${location.search}`);
      } else if (acc.role === 'WAREHOUSE') {
        navigate(`/gudang${location.search}`);
      } else if (acc.role === 'ADMIN') {
        navigate(`/admin/pengguna${location.search}`);
      } else {
        navigate(`/penjualan${location.search}`);
      }
    } catch {
      toast.error('Gagal beralih akun');
    }
  };

  // Filter groups and items based on permissions
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.permission ? hasPermission(item.permission) : true,
    ),
  })).filter((group) => group.items.length > 0);

  const getRoleBadgeInfo = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return { label: '👑 OWNER / DIREKTUR', className: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'FINANCE':
        return { label: '💼 FINANCE', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'SALES_OFFICE':
        return { label: '📊 SALES MARKETING', className: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'SALES_FIELD':
        return { label: '🌾 SALES LAPANG', className: 'bg-lime-100 text-lime-800 border-lime-300' };
      case 'WAREHOUSE':
        return { label: '📦 GUDANG & LOGISTIK', className: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'ADMIN':
        return { label: '⚙️ ADMIN', className: 'bg-slate-800 text-white border-slate-700' };
      default:
        return { label: role || 'STAF', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const badgeInfo = getRoleBadgeInfo(user?.role);

  const renderNavLinks = () => (
    <div className="space-y-6">
      {visibleGroups.map((group) => (
        <div key={group.groupName}>
          <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {group.groupName}
          </div>
          <nav className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={`${item.path}${location.search}`}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150',
                      isActive
                        ? 'bg-accent text-accent-foreground font-medium shadow-xs'
                        : 'text-[#475569] hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 text-inherit" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground antialiased">
      {/* Desktop Sidebar (240px) - Sticky and pinned */}
      <aside className="hidden lg:flex w-60 h-screen flex-col border-r border-border bg-card shrink-0 select-none sticky top-0">
        <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <Link to={`/penjualan${location.search}`} className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#006B45] text-white font-bold text-xs shadow-xs">
              T
            </div>
            <span className="font-semibold tracking-tight text-sm text-foreground">
              Tridhata Ops
            </span>
          </Link>
          <span className="text-[10px] font-medium bg-emerald-50 text-[#006B45] border border-emerald-200 px-1.5 py-0.5 rounded">
            v2.0
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 scroll-smooth">
          {renderNavLinks()}
        </div>

        {/* User Card in Sidebar Bottom */}
        <div className="shrink-0 p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-muted/50 border border-border/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#006B45]/10 text-[#006B45] text-xs font-bold shrink-0">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold truncate leading-tight">{user?.name}</span>
              <span className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                {user?.email}
              </span>
              <div className="mt-1">
                <span className={cn('text-[9px] font-semibold px-1.5 py-0.2 rounded border inline-block', badgeInfo.className)}>
                  {badgeInfo.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Header (56px) - Sticky and pinned */}
        <header className="sticky top-0 z-30 shrink-0 flex h-14 items-center justify-between border-b border-border bg-card/95 backdrop-blur-xs px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Sheet Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8 text-foreground"
                >
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Buka Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4 flex flex-col">
                <SheetHeader className="text-left pb-4 border-b border-border">
                  <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#006B45] text-white text-xs font-bold">
                      T
                    </div>
                    Tridhata Ops
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto py-4 scroll-smooth">
                  {renderNavLinks()}
                </div>
              </SheetContent>
            </Sheet>

            {/* Location Selector */}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              {locations.length > 1 ? (
                <Select
                  value={currentLocation || (locations[0]?.code.toLowerCase() ?? '')}
                  onValueChange={handleLocationChange}
                >
                  <SelectTrigger className="h-8 text-xs font-medium w-36 sm:w-44 bg-card">
                    <SelectValue placeholder="Pilih Lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem
                        key={loc.id}
                        value={loc.code.toLowerCase()}
                        className="text-xs"
                      >
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="text-xs font-normal">
                  {locations[0]?.name || 'Bogor'}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* DEMO ROLE SWITCHER (Sangat Praktis untuk Presentasi Demo) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium bg-emerald-50/70 text-[#006B45] border-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 px-2.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span className="hidden sm:inline">Demo Peran:</span>
                  <span className="font-semibold">{user?.role}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-1.5 shadow-lg">
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-bold text-muted-foreground">
                  GANTI PERAN CEPAT (MODE DEMO)
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DEMO_ACCOUNTS.map((acc) => {
                  const isCurrent = user?.email === acc.email || user?.role === acc.role;
                  return (
                    <DropdownMenuItem
                      key={acc.role}
                      onClick={() => handleSwitchDemoAccount(acc)}
                      className={cn(
                        'flex flex-col items-start gap-0.5 p-2 rounded-md cursor-pointer text-xs mb-1',
                        isCurrent ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-muted',
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          {acc.badge}
                        </span>
                        {isCurrent && <Check className="h-3.5 w-3.5 text-[#006B45]" />}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {acc.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 leading-tight">
                        {acc.desc}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sync Status Chip */}
            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40 text-[11px]">
              {syncStatus?.lastRun?.status === 'SUCCESS' ? (
                <>
                  <CheckCircle className="h-3 w-3 text-status-safe" />
                  <span className="text-muted-foreground">
                    Tersinkron {syncStatus.lastSuccessAt ? new Date(syncStatus.lastSuccessAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </>
              ) : syncStatus?.lastRun?.status === 'PARTIAL' ? (
                <>
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  <span className="text-warning">Sinkron Parsial</span>
                </>
              ) : syncStatus?.lastRun?.status === 'FAILED' ? (
                <>
                  <XCircle className="h-3 w-3 text-status-critical" />
                  <span className="text-status-critical">Sinkron Gagal</span>
                </>
              ) : syncStatus?.lastRun?.status === 'RUNNING' ? (
                <>
                  <RefreshCw className="h-3 w-3 text-primary animate-spin" />
                  <span className="text-primary">Menyinkronkan...</span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                  <span className="text-muted-foreground">Belum Sinkron</span>
                </>
              )}
            </div>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 h-8 px-2 text-xs font-medium hover:bg-muted"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#006B45]/10 text-[#006B45] text-[11px] font-semibold">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden sm:inline max-w-[120px] truncate">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold leading-none">{user?.name}</p>
                    <p className="text-[11px] leading-none text-muted-foreground">{user?.email}</p>
                    <div className="pt-1">
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border inline-block', badgeInfo.className)}>
                        {badgeInfo.label}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/ubah-sandi" className="flex items-center gap-2 text-xs cursor-pointer">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Ubah Kata Sandi</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-xs text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Keluar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content Outlet - Independent Smooth Scroll */}
        <main className="flex-1 overflow-y-auto min-w-0 p-4 sm:p-6 lg:p-8 scroll-smooth focus:outline-none bg-[#f9fbf9]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
