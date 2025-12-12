import { supabase } from '../config/supabaseClient.js';

/**
 * Middleware to check and enforce daily usage limits for freemium features
 * Free users get 5 uses per day per feature, premium users get unlimited access
 */
export const checkUsageLimit = (featureType, dailyLimit = 5) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const today = new Date().toISOString().split('T')[0];

      // Skip limits for premium/pro users, but still track usage
      const isPremium = user?.subscription_tier === 'premium' || user?.subscription_tier === 'pro';

      // Check current usage
      const { data: usage, error: usageError } = await supabase
        .from('user_usage_limits')
        .select('usage_count')
        .eq('user_id', userId)
        .eq('feature_type', featureType)
        .eq('usage_date', today)
        .single();

      if (usageError && usageError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking usage:', usageError);
        return next(); // Allow request on error
      }

      const currentUsage = usage?.usage_count || 0;

      // Check if limit exceeded (only for free users)
      if (!isPremium && currentUsage >= dailyLimit) {
        return res.status(429).json({
          error: 'Daily limit exceeded',
          message: `You've used ${currentUsage}/${dailyLimit} free uses of ${featureType.replace('_', ' ')} today.`,
          feature: featureType,
          currentUsage,
          limit: dailyLimit,
          upgradeRequired: true,
          upgradeMessage: 'Upgrade to premium for unlimited access!'
        });
      }

      // Increment usage count
      const { error: upsertError } = await supabase
        .from('user_usage_limits')
        .upsert({
          user_id: userId,
          feature_type: featureType,
          usage_date: today,
          usage_count: currentUsage + 1,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,feature_type,usage_date'
        });

      if (upsertError) {
        console.error('Error updating usage:', upsertError);
        // Don't block the request on update error
      }

      // Add usage info to request for potential frontend display
      req.usageInfo = {
        feature: featureType,
        currentUsage: currentUsage + 1,
        limit: isPremium ? 'unlimited' : dailyLimit,
        remaining: isPremium ? 'unlimited' : dailyLimit - (currentUsage + 1)
      };

      next();
    } catch (error) {
      console.error('Usage limit middleware error:', error);
      next(); // Allow request on error to avoid blocking users
    }
  };
};

/**
 * Get user's current usage statistics
 */
export const getUserUsageStats = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: usage, error } = await supabase
      .from('user_usage_limits')
      .select('feature_type, usage_count')
      .eq('user_id', userId)
      .eq('usage_date', today);

    if (error) throw error;

    // Get user subscription tier
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    return {
      usage: usage || [],
      subscriptionTier: user?.subscription_tier || 'free',
      isPremium: ['premium', 'pro'].includes(user?.subscription_tier)
    };
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return { usage: [], subscriptionTier: 'free', isPremium: false };
  }
};