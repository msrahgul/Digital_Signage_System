import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { User } from '../types';
import { mockUsers } from '../data/mockData';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
  }, []);

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(logout, 15 * 60 * 1000); // 15 minutes
    };

    const handleActivity = () => {
      resetInactivityTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    resetInactivityTimer(); // Initial setup

    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [logout]);

  const login = (username: string, password: string): boolean => {
    // Mock authentication - in production this would call an API
    const foundUser = mockUsers.find(u => u.username === username);

    if (foundUser && password === 'password') { // Simple mock password
      setUser(foundUser);
      localStorage.setItem('user', JSON.stringify(foundUser));
      return true;
    }
    return false;
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};