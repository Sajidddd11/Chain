import { supabase } from '../config/supabaseClient.js';

const USERS_TABLE = 'users';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

const parseCount = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
};

const normalizeBudgetPeriod = (value) => {
  const allowed = ['daily', 'weekly', 'monthly', 'yearly'];
  return allowed.includes(value) ? value : 'monthly';
};

export const getProfile = async (req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    // First, try to get all fields including subscription fields
    // If subscription columns don't exist, we'll fall back to basic fields
    let selectFields = `
        id,
        full_name,
        email,
        phone,
        role,
        household_size,
        household_children,
        household_teens,
        household_adults,
        household_elderly,
        dietary_preferences,
        budget_amount_bdt,
        budget_period,
        location,
        reward_points
      `;

    // Try to include subscription fields if they exist
    // We'll use a separate query to check if columns exist
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select(selectFields)
      .eq('id', req.user.id)
      .single();

    if (error) {
      // If error is about missing columns, try without subscription fields
      if (error.code === '42703' && error.message.includes('applink')) {
        // Retry without subscription fields
        const { data: basicData, error: basicError } = await supabase
          .from(USERS_TABLE)
          .select(selectFields)
          .eq('id', req.user.id)
          .single();

        if (basicError) throw basicError;

        // Add default subscription values
        return res.json({
          profile: {
            ...basicData,
            applink_subscribed: false,
            applink_subscription_status: null,
            applink_subscribed_at: null,
            applink_unsubscribed_at: null,
          }
        });
      }
      throw error;
    }

    // Try to get subscription fields separately if they exist
    try {
      const { data: subData } = await supabase
        .from(USERS_TABLE)
        .select('applink_subscribed, applink_subscription_status, applink_subscribed_at, applink_unsubscribed_at')
        .eq('id', req.user.id)
        .single();

      if (subData) {
        return res.json({ profile: { ...data, ...subData } });
      }
    } catch (subError) {
      // Subscription columns don't exist, return without them
      if (subError.code === '42703') {
        return res.json({
          profile: {
            ...data,
            applink_subscribed: false,
            applink_subscription_status: null,
            applink_subscribed_at: null,
            applink_unsubscribed_at: null,
          }
        });
      }
    }

    return res.json({ profile: data });
  } catch (error) {
    console.error('getProfile error', error);
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const {
    fullName,
    householdSize,
    dietaryPreferences,
    budgetAmountBdt,
    budgetPeriod,
    location,
    phone,
    childrenCount,
    teenCount,
    adultCount,
    elderlyCount,
  } = req.body;

  if (phone) {
    // Accept both: 01XXXXXXXXX or +8801XXXXXXXXX
    const phoneRegex = /^(\+?880)?0?1\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Please enter a valid 11-digit mobile number' });
    }
  }

  const budgetAmountNumber =
    budgetAmountBdt === undefined || budgetAmountBdt === null || budgetAmountBdt === ''
      ? null
      : Number(budgetAmountBdt);

  if (budgetAmountNumber !== null && (Number.isNaN(budgetAmountNumber) || budgetAmountNumber < 0)) {
    return res.status(400).json({ message: 'Budget amount must be a positive number' });
  }

  try {
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .update({
        full_name: fullName,
        household_size: householdSize,
        household_children: parseCount(childrenCount),
        household_teens: parseCount(teenCount),
        household_adults: parseCount(adultCount),
        household_elderly: parseCount(elderlyCount),
        dietary_preferences: dietaryPreferences,
        budget_amount_bdt: budgetAmountNumber,
        budget_period: normalizeBudgetPeriod(budgetPeriod),
        location,
        phone,
      })
      .eq('id', req.user.id)
      .select(`
        id,
        full_name,
        email,
        phone,
        role,
        household_size,
        household_children,
        household_teens,
        household_adults,
        household_elderly,
        dietary_preferences,
        budget_amount_bdt,
        budget_period,
        location,
        reward_points
      `)
      .single();

    if (error) throw error;

    return res.json({ profile: data });
  } catch (error) {
    console.error('updateProfile error', error);
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

