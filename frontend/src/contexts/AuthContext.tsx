import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types';
import api from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    // If we have a stored token, verify it with the backend before trusting it.
    // This prevents stale/invalid tokens from granting silent admin access.
    (async () => {
      if (storedToken && storedUser) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          // Call verify endpoint to confirm token is valid and get fresh user data
          const verifyResp = await api.get('/auth/verify');
          if (verifyResp?.data?.success && verifyResp.data.data?.user) {
            const userData = verifyResp.data.data.user;
            setToken(storedToken);
            setUser(userData);
            // Ensure localStorage matches verified user
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('token', storedToken);
            console.log('✅ Token verified on startup for user', userData.username || userData.id);
          } else {
            throw new Error('Token verification failed');
          }
        } catch (error: any) {
          const errMsg = error && (error.message || String(error));
          console.warn('Stored token invalid or verify failed - clearing auth:', errMsg);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete api.defaults.headers.common['Authorization'];
          setToken(null);
          setUser(null);
        }
      }

      setIsLoading(false);
    })();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsLoading(true);
      console.log('🔐 Attempting login with:', { username, password: '***' });
      console.log('🌐 API base URL:', api.defaults.baseURL);
      console.log('🔗 Full login URL:', `${api.defaults.baseURL}/auth/login`);
      
      const response = await api.post('/auth/login', { username, password });
      console.log('✅ Login response received:', response.status, response.statusText);
  console.log('📄 Response data:', response.data);
  // Extra debug: dump nested fields for visibility in browser console
  try { console.debug('📦 response.data.success=', response.data && response.data.success); } catch(e){}
  try { console.debug('🔑 token present=', !!(response.data && response.data.data && response.data.data.token)); } catch(e){}
      
  if (response.data && response.data.success) {
        const { token: newToken, user: userData } = response.data.data;
        
        console.log('🎯 Login successful! Setting user data:', { 
          token: newToken ? 'Token received' : 'No token', 
          user: userData 
        });
        
        setToken(newToken);
        setUser(userData);
        
        // Store in localStorage
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Set token in API headers
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
  return { success: true };
      } else {
        // Provide more diagnostic logs when login fails so the in-browser error is clearer
        console.warn('⚠️ Login response indicates failure:', response.status, response.data);
        // If backend returned a message, include it for the caller/UI
        const backendMsg = response.data && (response.data.message || (response.data.error && response.data.error.message));
        if (backendMsg) console.warn('⚠️ Backend message:', backendMsg);
  const backendMessage = response.data && (response.data.message || (response.data.error && response.data.error.message));
  return { success: false, message: backendMessage || 'Invalid credentials' };
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      if (error.response) {
        console.error('📄 Error response data:', error.response.data);
        console.error('🔢 Error status:', error.response.status);
        console.error('📋 Error headers:', error.response.headers);
        
        // Check for specific error types
        if (error.response.status === 401) {
          console.error('🚫 Authentication failed - Invalid credentials');
        } else if (error.response.status === 400) {
          console.error('📝 Bad request - Check form validation');
        } else if (error.response.status === 0 || error.code === 'NETWORK_ERROR') {
          console.error('🌐 Network error - Backend might be down or CORS issue');
        }
      } else if (error.request) {
        console.error('📡 Request made but no response received:', error.request);
        console.error('🌐 Possible network/CORS issue or backend is down');
      } else {
        console.error('⚙️ Error setting up request:', error.message);
      }
      
      // Try to extract backend error message
    let backendMessage: string | undefined = undefined;
      try {
        if (error.response && error.response.data && (error.response.data.message || error.response.data.error)) {
      backendMessage = error.response.data.message || (error.response.data.error && error.response.data.error.message);
        }
      } catch (e) {
        // ignore
      }
    return { success: false, message: backendMessage || 'An error occurred during login' };
    } finally {
      setIsLoading(false);
    }
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
    isAuthenticated: !!user && !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
