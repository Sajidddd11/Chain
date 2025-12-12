import { getUserUsageStats } from '../middleware/usageLimitMiddleware.js';

/**
 * Get user's current usage statistics
 */
export const getUsageStats = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stats = await getUserUsageStats(userId);

    // Transform the data to match frontend expectations
    const transformedStats = stats.usage.map(item => ({
      feature: item.feature_type,
      currentUsage: item.usage_count,
      limit: stats.isPremium ? 'unlimited' : 5, // Assuming 5 is the default limit
      remaining: stats.isPremium ? 'unlimited' : Math.max(0, 5 - item.usage_count)
    }));

    res.json({
      success: true,
      stats: transformedStats
    });
  } catch (error) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({ error: 'Failed to get usage stats' });
  }
};