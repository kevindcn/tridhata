import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  AuthUser,
  ChangePasswordDto,
  LoginDto,
  Permission,
} from '@tridhata/shared';
import {
  api,
  setAccessToken,
  setSessionExpiredHandler,
  ApiError,
} from '@/lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (dto: LoginDto) => Promise<void>;
  loginWithTicket: (ticket: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (dto: ChangePasswordDto) => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const me = await api<AuthUser>('/me');
      setUser(me);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  const bootstrapSession = useCallback(async () => {
    try {
      const res = await api<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });
      if (res.accessToken) {
        setAccessToken(res.accessToken);
        await fetchCurrentUser();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCurrentUser]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setAccessToken(null);
    });

    bootstrapSession();
  }, [bootstrapSession]);

  const login = async (dto: LoginDto) => {
    const res = await api<{ accessToken: string; user: AuthUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    );

    setAccessToken(res.accessToken);
    setUser(res.user);
  };

  const loginWithTicket = async (ticket: string) => {
    const res = await api<{ accessToken: string; user: AuthUser }>(
      '/auth/google/exchange',
      {
        method: 'POST',
        body: JSON.stringify({ ticket }),
      },
    );

    setAccessToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Ignored
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const changePassword = async (dto: ChangePasswordDto) => {
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(dto),
    });

    if (user) {
      setUser({ ...user, mustChangePassword: false });
    }
  };

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        loginWithTicket,
        logout,
        changePassword,
        refreshUser: fetchCurrentUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
};

export { ApiError };
