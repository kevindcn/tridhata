const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onSessionExpired: () => void = () => {};

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

export const getAccessToken = () => accessToken;

export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { code?: string; message?: string; details?: unknown } | null,
  ) {
    super(body?.message ?? 'Terjadi kesalahan');
    this.name = 'ApiError';
  }
}

async function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (r) => (r.ok ? ((await r.json()) as { accessToken: string }).accessToken : null))
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && canRetry && !path.startsWith('/auth/')) {
    const t = await refreshAccessToken();
    if (t) {
      setAccessToken(t);
      return api<T>(path, init, false);
    }
    setAccessToken(null);
    onSessionExpired();
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errorBody);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
