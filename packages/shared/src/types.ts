import { Permission, RoleName } from './permissions';
import { SheetEntity } from './schemas/sheet-mapping';

export type StockStatus = 'SAFE' | 'MINIMUM' | 'CRITICAL' | 'EMPTY';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  permissions: Permission[];
  locationIds: string[];
  defaultLocationId: string | null;
  mustChangePassword: boolean;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  division: string | null;
  active: boolean;
  mustChangePassword: boolean;
  defaultLocationId: string | null;
  locations: Array<{ id: string; code: string; name: string }>;
  extraPermissions: Permission[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserResponse {
  user: UserResponse;
  temporaryPassword: string;
}

export interface ResetPasswordResponse {
  temporaryPassword: string;
}

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogResponse {
  items: AuditLogItem[];
  nextCursor: string | null;
}

export interface ReqCtx {
  ip?: string;
  userAgent?: string;
}

export interface SalesDashboard {
  meta: {
    locationId: string;
    from: string;
    to: string;
    daysElapsed: number;
    daysInMonth: number;
    lastSuccessAt: string | null;
    stale: boolean;
  };
  cards: {
    revenue: number | null;
    previousMonthRevenue: number | null;
    soldQty: number;
    forecastQty: number;
    soldVsForecastPct: number | null;
    projectedMonthEndQty: number | null;
    stockShortageQty: number | null;
    shortageSkuCount: number;
    emptySkuCount: number;
    criticalSkuCount: number;
    stockValue: number | null;
  };
  daily: Array<{ date: string; qty: number; revenue: number | null }>;
  products: Array<{
    sku: string;
    name: string;
    soldQty: number;
    forecastQty: number;
    pct: number | null;
    stockQty: number;
    status: StockStatus;
  }>;
}

export interface InventoryDashboard {
  meta: { locationId: string; lastSuccessAt: string | null; stale: boolean };
  cards: {
    totalSku: number;
    safeCount: number;
    minimumCount: number;
    criticalCount: number;
    emptyCount: number;
    stockValue: number | null;
  };
  rows: Array<{
    sku: string;
    name: string;
    qty: number;
    minStock: number;
    safetyStock: number;
    status: StockStatus;
    value: number | null;
    syncedAt: string;
  }>;
}

export interface ProductionDashboard {
  meta: { locationId: string; period: string; lastSuccessAt: string | null; stale: boolean };
  cards: {
    totalTarget: number;
    totalActual: number;
    achievementPct: number | null;
    skuReached: number;
    skuBelow: number;
  };
  rows: Array<{
    sku: string;
    name: string;
    target: number;
    actual: number;
    pct: number | null;
    gap: number;
  }>;
}

export interface SyncReport {
  entities: Array<{
    entity: SheetEntity;
    tab: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    accepted: number;
    rejected: number;
    error?: {
      code: 'MISSING_HEADERS' | 'MAPPING_NOT_CONFIGURED' | 'SHEET_UNREACHABLE';
      message: string;
      headers?: string[];
    };
    rejectedRows: Array<{ row: number; field?: string; reason: string }>;
  }>;
}

export interface SyncStatusResponse {
  lastSuccessAt: string | null;
  lastRun: {
    status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
    startedAt: string;
    finishedAt: string | null;
    rowsAccepted: number;
    rowsRejected: number;
    report?: SyncReport | null;
  } | null;
  stale: boolean;
  staleAfterMinutes: number;
}

export interface ApprovalItem {
  id: string;
  requestId: string;
  approverId: string;
  approver: {
    id: string;
    name: string;
    email: string;
  };
  level: number;
  decision: 'APPROVED' | 'REJECTED';
  note: string | null;
  decidedAt: string;
}

export interface RequestItem {
  id: string;
  requesterId: string;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  locationId: string;
  type: string;
  title: string;
  note: string | null;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  version: number;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  approvals: ApprovalItem[];
}
