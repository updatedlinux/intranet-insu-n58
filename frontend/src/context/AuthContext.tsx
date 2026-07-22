import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loginRequest, logoutRequest, meRequest } from '../api/auth';
import { ApiError } from '../api/client';
import type { AuthUser } from '../api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const refreshSession = useCallback(async () => {
    try {
      const { user: currentUser } = await meRequest();
      setUser(currentUser);
      setStatus('authenticated');
    } catch (error) {
      setUser(null);
      setStatus('unauthenticated');
      if (error instanceof ApiError && error.status !== 401) {
        console.error('[auth] Error al validar sesión:', error.message);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { user: currentUser } = await meRequest();
        if (!active) return;
        setUser(currentUser);
        setStatus('authenticated');
      } catch (error) {
        if (!active) return;
        setUser(null);
        setStatus('unauthenticated');
        if (error instanceof ApiError && error.status !== 401) {
          console.error('[auth] Error al validar sesión:', error.message);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email.trim(), password);
    setUser(result.user);
    setStatus('authenticated');
    return { mustChangePassword: result.mustChangePassword };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated' && user !== null,
      login,
      logout,
      refreshSession,
    }),
    [user, status, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
