import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequirePermission } from '@/features/auth/RequirePermission';
import { AppLayout } from '@/app/layout/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage';
import { UsersPage } from '@/features/admin/UsersPage';
import { AuditLogPage } from '@/features/admin/AuditLogPage';
import { SalesPage } from '@/features/sales/SalesPage';
import { ProductionPage } from '@/features/production/ProductionPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { SyncConfigPage } from '@/features/admin/SyncConfigPage';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated Routes */}
          <Route element={<RequireAuth />}>
            {/* Forced Password Change Route */}
            <Route path="/ubah-sandi" element={<ChangePasswordPage />} />

            {/* Application Shell with Sidebar and Header */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/penjualan" replace />} />

              <Route
                path="/penjualan"
                element={
                  <RequirePermission permission="dashboard:read">
                    <SalesPage />
                  </RequirePermission>
                }
              />

              <Route
                path="/produksi"
                element={
                  <RequirePermission permission="dashboard:read">
                    <ProductionPage />
                  </RequirePermission>
                }
              />

              <Route
                path="/persediaan"
                element={
                  <RequirePermission permission="dashboard:read">
                    <InventoryPage />
                  </RequirePermission>
                }
              />

              <Route
                path="/persetujuan"
                element={
                  <RequirePermission permission="approval:create">
                    <ApprovalsPage />
                  </RequirePermission>
                }
              />

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
          <Route path="*" element={<Navigate to="/penjualan" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
