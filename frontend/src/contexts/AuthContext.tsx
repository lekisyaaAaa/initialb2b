import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types';
import api, { authService, systemService } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const verifyResp = await api.get('/auth/verify');
          if (verifyResp?.data?.success && verifyResp.data.data?.user) {
            const userData = verifyResp.data.data.user;
            setToken(storedToken);
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('token', storedToken);
            console.log('✅ Token verified on startup for user', userData.username || userData.id);
          } else {
            throw new Error('Token verify failed');
          }
        } catch (e: any) {
          console.warn('Stored token verify failed, clearing local auth:', e && (e.message || String(e)));
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete api.defaults.headers.common['Authorization'];
          setToken(null);
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: any = null;
    setIsLoading(true);

  // No preflight health check here: directly attempt login and rely on targeted error handling.

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        // centralized auth call (respects baseURL and interceptors)
        const resp = await authService.login({ username, password });
        if (resp?.data?.success && resp.data.data) {
          const newToken = resp.data.data.token;
          const userData = resp.data.data.user;
          setToken(newToken);
          setUser(userData);
          localStorage.setItem('token', newToken);
          localStorage.setItem('user', JSON.stringify(userData));
          (api.defaults.headers as any).Authorization = `Bearer ${newToken}`;
          setIsLoading(false);
          return { success: true };
        }

  const backendMessage = resp?.data?.message || (resp?.data as any)?.error?.message || 'Invalid credentials';
        setIsLoading(false);
        return { success: false, message: backendMessage };
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;

        // handle explicit backend auth failures without retrying
        if (status === 400 || status === 401 || status === 403) {
          const backendMessage = err?.response?.data?.message || (err?.response?.data as any)?.error?.message || (status === 401 ? 'Invalid username or password' : 'Invalid request');
          setIsLoading(false);
          // notify other windows/components if auth expired
          if (status === 401 && typeof window !== 'undefined') {
            try { window.dispatchEvent(new CustomEvent('auth:expired')); } catch (_) { /* ignore */ }
          }
          return { success: false, message: backendMessage };
        }

        // network errors (no response) — retry with backoff
        if (!err?.response) {
          const backoff = 300 * Math.pow(2, attempt - 1);
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        // unknown error - break and surface friendly message
        break;
      }
    }

    setIsLoading(false);
    let friendly = 'An error occurred during login';
    if (lastError?.response?.data?.message) friendly = lastError.response.data.message;
    else if (lastError?.code === 'ECONNREFUSED') friendly = 'Cannot reach authentication server (connection refused)';
    else if (lastError?.message && /network|timeout/i.test(lastError.message)) friendly = 'Network error communicating with server';
    return { success: false, message: friendly };
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
