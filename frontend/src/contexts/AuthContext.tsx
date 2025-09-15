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

    // First, check server health to avoid generic network errors
    try {
      await api.get('/health');
    } catch (healthError: any) {
      setIsLoading(false);
      if (healthError.code === 'ECONNREFUSED' || healthError.code === 'ENOTFOUND' || healthError.code === 'ETIMEDOUT') {
        return { success: false, message: 'Server offline. Please check if the backend is running.' };
      }
      return { success: false, message: 'Unable to connect to server. Please try again.' };
    }

    // Attempt login with retry logic
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
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

        const backendMessage = resp?.data?.message || 'Invalid credentials';
        setIsLoading(false);
        return { success: false, message: backendMessage };
      } catch (err: any) {
        lastError = err;

        // Handle specific error types
        if (err.response?.status === 401) {
          setIsLoading(false);
          return { success: false, message: 'Invalid username or password' };
        }

        if (err.response?.status === 503) {
          setIsLoading(false);
          return { success: false, message: 'Server temporarily unavailable. Please try again later.' };
        }

        // Network error - retry if attempts remaining
        if ((err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') && attempt < maxAttempts) {
          console.warn(`Login attempt ${attempt} failed, retrying in 2s...`, err.message);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        // Final attempt failed
        if (attempt >= maxAttempts) {
          break;
        }
      }
    }

    // All attempts failed
    setIsLoading(false);
    const errorMessage = lastError?.response?.data?.message ||
                        (lastError?.code === 'ECONNREFUSED' || lastError?.code === 'ENOTFOUND' ? 'Network error. Please check your connection.' : 'Login failed. Please try again.');
    return { success: false, message: errorMessage };
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
