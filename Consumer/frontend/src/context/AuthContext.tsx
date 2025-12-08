import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { UserProfile, AuthResponse } from '../types';

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  status: 'idle' | 'loading' | 'ready';
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  householdSize?: number | null;
  dietaryPreferences?: string | null;
  budgetAmountBdt?: number | null;
  budgetPeriod?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  childrenCount?: number | null;
  teenCount?: number | null;
  adultCount?: number | null;
  elderlyCount?: number | null;
  location?: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = 'innovatex_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');

  const refreshProfile = async () => {
    if (!token) {
      setUser(null);
      setStatus('ready');
      return;
    }
    try {
      setStatus('loading');
      const { profile } = await api.getProfile(token);
      setUser(profile);
      setStatus('ready');
    } catch (error) {
      console.error('Failed to load profile', error);
      setToken(null);
      localStorage.removeItem(STORAGE_KEY);
      setStatus('ready');
    }
  };

  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAuthSuccess = (payload: AuthResponse) => {
    setToken(payload.token);
    localStorage.setItem(STORAGE_KEY, payload.token);
    setUser({
      id: payload.user.id,
      full_name: payload.user.fullName,
      email: payload.user.email,
      phone: payload.user.phone ?? null,
      role: payload.user.role ?? 'user',
      household_size: payload.user.householdSize ?? null,
      household_children: payload.user.householdChildren ?? null,
      household_teens: payload.user.householdTeens ?? null,
      household_adults: payload.user.householdAdults ?? null,
      household_elderly: payload.user.householdElderly ?? null,
      dietary_preferences: payload.user.dietaryPreferences ?? null,
      budget_amount_bdt: payload.user.budgetAmountBdt ?? null,
      budget_period: payload.user.budgetPeriod ?? null,
      location: payload.user.location ?? null,
        reward_points: payload.user.rewardPoints ?? 0,
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      status,
      refreshProfile,
      login: async (email: string, password: string) => {
        const payload = await api.login({ email, password });
        handleAuthSuccess(payload);
      },
      register: async (payload: RegisterPayload) => {
        const response = await api.register(payload);
        handleAuthSuccess(response);
      },
      logout: () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [token, user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

