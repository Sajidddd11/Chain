import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export interface UsageStat {
  feature: string;
  currentUsage: number;
  limit: number | 'unlimited';
  remaining: number | 'unlimited';
}

export function useUsageStats() {
  const { token, user } = useAuth();
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsageStats = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await api.getUsageStats(token);
      if (response.success) {
        setUsageStats(response.stats);
      }
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && user) {
      fetchUsageStats();
    }
  }, [token, user, fetchUsageStats]);

  const getFeatureStats = useCallback((featureName: string): UsageStat | null => {
    return usageStats.find(stat => stat.feature === featureName) || null;
  }, [usageStats]);

  const isFeatureLocked = useCallback((featureName: string): boolean => {
    const stat = getFeatureStats(featureName);
    if (!stat) return false;
    
    const isPremium = user?.subscription_tier === 'premium' || user?.subscription_tier === 'pro';
    if (isPremium) return false;
    
    return typeof stat.limit === 'number' && stat.currentUsage >= stat.limit;
  }, [getFeatureStats, user]);

  const isPremium = user?.subscription_tier === 'premium' || user?.subscription_tier === 'pro';

  return {
    usageStats,
    loading,
    fetchUsageStats,
    getFeatureStats,
    isFeatureLocked,
    isPremium
  };
}
