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
    groupName: 'DASHBOARD',
    items: [
      {
        label: 'Ringkasan Penjualan',
        path: '/penjualan',
        icon: TrendingUp,
        permission: 'dashboard:read',
      },
      {
        label: 'Rencana Produksi',
        path: '/produksi',
        icon: Factory,
        permission: 'dashboard:read',
      },
      {
        label: 'Status Persediaan',
        path: '/persediaan',
        icon: Boxes,
        permission: 'dashboard:read',
      },
    ],
  },
  {
    groupName: 'OPERASIONAL',
    items: [
      {
        label: 'Persetujuan Diskon',
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

export const AppLayout: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
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
        // Default location check
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

  // Filter groups and items based on permissions
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.permission ? hasPermission(item.permission) : true,
    ),
  })).filter((group) => group.items.length > 0);

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
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground',
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

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'default';
      case 'FINANCE':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      {/* Desktop Sidebar (240px) */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0 select-none">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <Link to={`/penjualan${location.search}`} className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-xs shadow-xs">
              T
            </div>
            <span className="font-semibold tracking-tight text-sm text-foreground">
              Tridhata Ops
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {renderNavLinks()}
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-muted/40">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium truncate">{user?.name}</span>
              <span className="text-[11px] text-muted-foreground truncate">{user?.email}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header (56px) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 backdrop-blur-xs px-4 sm:px-6">
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
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                      T
                    </div>
                    Tridhata Ops
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto py-4">
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

          <div className="flex items-center gap-3">
            {/* Sync Status Chip */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40 text-[11px]">
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
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden sm:inline max-w-[120px] truncate">{user?.name}</span>
                  <Badge variant={getRoleBadgeVariant(user?.role)} className="text-[10px] px-1.5 py-0">
                    {user?.role}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold leading-none">{user?.name}</p>
                    <p className="text-[11px] leading-none text-muted-foreground">{user?.email}</p>
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

        {/* Global Stale Banner (SPEC 9.4 Poin 10) */}
        {syncStatus?.stale && (
          <div className="bg-warning-bg border-b border-warning/30 px-4 py-2 text-xs text-warning flex items-center justify-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              Data terakhir diperbarui {syncStatus.lastSuccessAt ? new Date(syncStatus.lastSuccessAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'belum pernah'}. Angka di bawah mungkin belum mencerminkan kondisi terbaru.
            </span>
          </div>
        )}

        {/* Page Content Outlet */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
