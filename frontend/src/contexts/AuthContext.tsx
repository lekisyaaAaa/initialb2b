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

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        // Set token in API headers
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('🔐 Attempting login with:', { username, password: '***' });
      console.log('🌐 API base URL:', api.defaults.baseURL);
      console.log('🔗 Full login URL:', `${api.defaults.baseURL}/auth/login`);
      
      const response = await api.post('/auth/login', { username, password });
      console.log('✅ Login response received:', response.status, response.statusText);
      console.log('📄 Response data:', response.data);
      
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
        
        return true;
      } else {
        console.warn('⚠️ Login response indicates failure:', response.data);
        return false;
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
      
      return false;
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
