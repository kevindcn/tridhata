export const PERMISSIONS = [
  'dashboard:read',
  'finance:read', // melihat omzet dan nilai stok
  'export:run',
  'approval:create',
  'approval:read_all', // tanpa ini hanya melihat pengajuan miliknya
  'approval:decide',
  'user:manage',
  'audit:read',
  'sync:manage',
  'location:all', // melihat semua lokasi
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type RoleName = 'ADMIN' | 'FINANCE' | 'STAFF';

export const ROLE_DEFAULTS: Record<RoleName, Permission[]> = {
  ADMIN: [
    'dashboard:read',
    'finance:read',
    'export:run',
    'approval:create',
    'approval:read_all',
    'user:manage',
    'audit:read',
    'sync:manage',
    'location:all',
  ],
  FINANCE: [
    'dashboard:read',
    'finance:read',
    'export:run',
    'approval:create',
    'approval:read_all',
    'approval:decide',
    'location:all',
  ],
  STAFF: ['dashboard:read', 'export:run', 'approval:create'],
};
