import { supabase } from '../config/supabaseClient.js';

const USER_INVENTORY_TABLE = 'user_inventory';
const USERS_TABLE = 'users';
const CONSUMPTION_LOGS_TABLE = 'consumption_logs';
const RESOURCES_TABLE = 'resources';

const normalizeBudgetPeriod = (value) => {
  const allowed = ['daily', 'weekly', 'monthly', 'yearly'];
  return allowed.includes(value) ? value : 'monthly';
};

const getBudgetPeriodLabel = (period) => {
  switch (period) {
    case 'daily':
      return 'today';
    case 'weekly':
      return 'this week';
    case 'yearly':
      return 'this year';
    default:
      return 'this month';
  }
};

const getBudgetPeriodStart = (period) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'daily':
      return start;
    case 'weekly': {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1; // start week on Monday
      start.setDate(start.getDate() - diff);
      return start;
    }
    case 'yearly':
      start.setMonth(0, 1);
      return start;
    case 'monthly':
    default:
      start.setDate(1);
      return start;
  }
};

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

export const getDashboardSummary = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = req.user.id;

  try {
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);

    const [
      { data: inventory, count: totalInventory },
      { count: expiringCount },
      { data: logs },
      { count: usageCount },
      { data: resources }
    ] = await Promise.all([
      // 1. Inventory Preview + Total Count
      supabase
        .from(USER_INVENTORY_TABLE)
        .select('id, custom_name, expires_at', { count: 'exact' })
        .eq('user_id', userId)
        .order('expires_at', { ascending: true })
        .limit(5),
      
      // 2. Expiring Soon Count
      supabase
        .from(USER_INVENTORY_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('expires_at', threeDaysFromNow.toISOString())
        .gte('expires_at', today.toISOString()),

      // 3. Recent Logs Preview
      supabase
        .from(CONSUMPTION_LOGS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(5),

      // 4. Usage This Week Count
      supabase
        .from(CONSUMPTION_LOGS_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('logged_at', oneWeekAgo.toISOString()),

      // 5. Resources
      supabase
        .from(RESOURCES_TABLE)
        .select('*')
        .limit(5),
    ]);

    const { data: userBudget, error: userBudgetError } = await supabase
      .from(USERS_TABLE)
      .select('budget_amount_bdt, budget_period')
      .eq('id', userId)
      .single();

    if (userBudgetError) throw userBudgetError;

    let budgetUsage = null;
    if (userBudget?.budget_amount_bdt) {
      const period = normalizeBudgetPeriod(userBudget.budget_period);
      const periodStart = getBudgetPeriodStart(period);
      const { data: spendingRows, error: spendingError } = await supabase
        .from(USER_INVENTORY_TABLE)
        .select('price, purchased_at')
        .eq('user_id', userId)
        .not('price', 'is', null)
        .gte('purchased_at', periodStart.toISOString().slice(0, 10));

      if (spendingError) throw spendingError;

      const used = (spendingRows || []).reduce((sum, row) => sum + Number(row.price || 0), 0);
      const budgetAmount = Number(userBudget.budget_amount_bdt);
      const remaining = Math.max(budgetAmount - used, 0);
      const percentage = budgetAmount ? Math.min((used / budgetAmount) * 100, 999) : 0;

      budgetUsage = {
        budgetAmount,
        used,
        remaining,
        percentage,
        period,
        periodLabel: getBudgetPeriodLabel(period),
        since: periodStart.toISOString().slice(0, 10),
      };
    }

    return res.json({
      totals: {
        inventory: totalInventory || 0,
        expiringSoon: expiringCount || 0,
        recentLogs: usageCount || 0, // Using usage this week count for the dashboard card
      },
      inventoryPreview: inventory || [],
      recentLogs: logs || [],
      recommendedResources: resources || [],
      budgetUsage,
    });
  } catch (error) {
    console.error('getDashboardSummary error', error);
    return res.status(500).json({ message: 'Failed to load dashboard', error: error.message });
  }
};

