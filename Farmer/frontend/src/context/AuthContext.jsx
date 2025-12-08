import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const normalizeUser = (rawUser) => {
    if (!rawUser) return rawUser;
    return {
      ...rawUser,
      wantsCallAlert: !!rawUser.wantsCallAlert
    };
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(normalizeUser(JSON.parse(savedUser)));
          
          // Verify token is still valid
          const profileResponse = await authAPI.getProfile();
          const profileUser = profileResponse?.data?.user;
          if (profileUser) {
            const normalized = normalizeUser(profileUser);
            setUser(normalized);
            localStorage.setItem('user', JSON.stringify(normalized));
          }
        } catch (error) {
          console.error('Token validation failed:', error);
          logout();
        }
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      const { token: newToken, user: userData } = response.data;
      
      console.log('Login response user data:', userData); // Debug log
      
      setToken(newToken);
      const normalizedUser = normalizeUser(userData);
      setUser(normalizedUser);
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      return { success: true, user: normalizedUser };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      return { success: false, error: errorMessage };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await authAPI.signup(userData);
      const { token: newToken, user: newUser } = response.data;
      
      setToken(newToken);
      const normalizedUser = normalizeUser(newUser);
      setUser(normalizedUser);
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      return { success: true, user: normalizedUser };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.errors?.[0]?.msg || 
                          'Signup failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUser = (updates = {}) => {
    setUser(prev => {
      if (!prev) return prev;
      const normalized = normalizeUser({ ...prev, ...updates });
      localStorage.setItem('user', JSON.stringify(normalized));
      return normalized;
    });
  };

  const value = {
    user,
    token,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
