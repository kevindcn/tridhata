import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequirePermission } from '@/features/auth/RequirePermission';
import { AppLayout } from '@/app/layout/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage';
import { UsersPage } from '@/features/admin/UsersPage';
import { AuditLogPage } from '@/features/admin/AuditLogPage';
import { SalesPage } from '@/features/sales/SalesPage';
import { ProductionPage } from '@/features/production/ProductionPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { SyncConfigPage } from '@/features/admin/SyncConfigPage';
import { FieldActivityPage } from '@/features/field/FieldActivityPage';
import { WarehouseOpsPage } from '@/features/warehouse/WarehouseOpsPage';
import { Toaster } from '@/components/ui/sonner';

/**
 * Intelligent home redirect based on active user's primary role/permissions
 */
function HomeRedirect() {
  const { hasPermission } = useAuth();
  if (hasPermission('dashboard:sales')) return <Navigate to="/penjualan" replace />;
  if (hasPermission('field:activity')) return <Navigate to="/lapangan" replace />;
  if (hasPermission('warehouse:ops')) return <Navigate to="/gudang" replace />;
  if (hasPermission('dashboard:inventory')) return <Navigate to="/persediaan" replace />;
  if (hasPermission('dashboard:production')) return <Navigate to="/produksi" replace />;
  if (hasPermission('approval:create')) return <Navigate to="/persetujuan" replace />;
  if (hasPermission('user:manage')) return <Navigate to="/admin/pengguna" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Authenticated Routes */}
          <Route element={<RequireAuth />}>
            {/* Forced Password Change Route */}
            <Route path="/ubah-sandi" element={<ChangePasswordPage />} />

            {/* Application Shell with Sidebar and Header */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomeRedirect />} />

              {/* Eksekutif / Penjualan */}
              <Route
                path="/penjualan"
                element={
                  <RequirePermission permission="dashboard:sales">
                    <SalesPage />
                  </RequirePermission>
                }
              />

              {/* Pabrik / Rencana Produksi */}
              <Route
                path="/produksi"
                element={
                  <RequirePermission permission="dashboard:production">
                    <ProductionPage />
                  </RequirePermission>
                }
              />

              {/* Gudang & Stok / Persediaan */}
              <Route
                path="/persediaan"
                element={
                  <RequirePermission permission="dashboard:inventory">
                    <InventoryPage />
                  </RequirePermission>
                }
              />

              {/* Sales Lapang & Agronomis */}
              <Route
                path="/lapangan"
                element={
                  <RequirePermission permission="field:activity">
                    <FieldActivityPage />
                  </RequirePermission>
                }
              />

              {/* Staf Gudang & Logistik PIC */}
              <Route
                path="/gudang"
                element={
                  <RequirePermission permission="warehouse:ops">
                    <WarehouseOpsPage />
                  </RequirePermission>
                }
              />

              {/* Persetujuan, Kasbon & ACC Owner */}
              <Route
                path="/persetujuan"
                element={
                  <RequirePermission permission="approval:create">
                    <ApprovalsPage />
                  </RequirePermission>
                }
              />

              {/* Administrasi */}
              <Route
                path="/admin/pengguna"
                element={
                  <RequirePermission permission="user:manage">
                    <UsersPage />
                  </RequirePermission>
                }
              />

              <Route
                path="/admin/log"
                element={
                  <RequirePermission permission="audit:read">
                    <AuditLogPage />
                  </RequirePermission>
                }
              />

              <Route
                path="/admin/sinkron"
                element={
                  <RequirePermission permission="sync:manage">
                    <SyncConfigPage />
                  </RequirePermission>
                }
              />
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
