export const PERMISSIONS = [
  'dashboard:read',
  'dashboard:sales',
  'dashboard:production',
  'dashboard:inventory',
  'finance:read', // melihat omzet dan nilai stok
  'export:run',
  'approval:create',
  'approval:read_all', // tanpa ini hanya melihat pengajuan miliknya
  'approval:decide',
  'approval:finance_create', // finance membuat permohonan dana/kasbon/PO ke owner
  'approval:owner_decide', // wewenang ACC tertinggi untuk owner
  'field:activity', // kegiatan sales lapang & upload foto demplot/kios
  'warehouse:ops', // mutasi gudang & upload surat jalan/bukti fisik barang
  'user:manage',
  'audit:read',
  'sync:manage',
  'location:all', // melihat semua lokasi
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type RoleName =
  | 'ADMIN'
  | 'OWNER'
  | 'FINANCE'
  | 'SALES_OFFICE'
  | 'SALES_FIELD'
  | 'WAREHOUSE'
  | 'STAFF';

export const ROLE_DEFAULTS: Record<RoleName, Permission[]> = {
  ADMIN: [
    'dashboard:read',
    'dashboard:sales',
    'dashboard:production',
    'dashboard:inventory',
    'finance:read',
    'export:run',
    'approval:create',
    'approval:read_all',
    'field:activity',
    'warehouse:ops',
    'user:manage',
    'audit:read',
    'sync:manage',
    'location:all',
  ],
  OWNER: [
    'dashboard:read',
    'dashboard:sales',
    'dashboard:production',
    'dashboard:inventory',
    'finance:read',
    'export:run',
    'approval:create',
    'approval:read_all',
    'approval:decide',
    'approval:owner_decide',
    'field:activity',
    'warehouse:ops',
    'user:manage',
    'audit:read',
    'sync:manage',
    'location:all',
  ],
  FINANCE: [
    'dashboard:read',
    'dashboard:sales',
    'dashboard:inventory',
    'finance:read',
    'export:run',
    'approval:create',
    'approval:read_all',
    'approval:decide',
    'approval:finance_create',
    'location:all',
  ],
  SALES_OFFICE: [
    'dashboard:read',
    'dashboard:sales',
    'dashboard:inventory',
    'export:run',
    'approval:create',
  ],
  SALES_FIELD: [
    'field:activity',
    'approval:create',
  ],
  WAREHOUSE: [
    'dashboard:read',
    'dashboard:production',
    'dashboard:inventory',
    'warehouse:ops',
    'export:run',
  ],
  STAFF: [
    'dashboard:read',
    'dashboard:production',
    'dashboard:inventory',
    'warehouse:ops',
    'export:run',
  ],
};
