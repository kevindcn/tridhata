import React from 'react';
import { Permission } from '@tridhata/shared';
import { useAuth } from './AuthContext';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface RequirePermissionProps {
  permission: Permission;
  children: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  children,
}) => {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Akses Terbatas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          Anda tidak memiliki izin akses (<code>{permission}</code>) untuk melihat halaman ini. Silakan hubungi Administrator jika Anda membutuhkan akses ini.
        </p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link to="/penjualan">Kembali ke Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
