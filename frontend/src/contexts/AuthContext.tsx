import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, LoginPayload } from '../types';
import { login as apiLogin, logout as apiLogout, getCurrentUser } from '../api/auth';
import { getTokens, clearTokens, setTokens } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user from API
  const fetchCurrentUser = async () => {
    try {
      const tokens = getTokens();
      if (!tokens?.access) {
        setUser(null);
        return;
      }

      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (credentials: LoginPayload) => {
    try {
      const tokens = await apiLogin(credentials);
      setTokens(tokens);
      await fetchCurrentUser();
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
