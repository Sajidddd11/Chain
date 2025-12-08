import { supabase } from '../config/supabaseClient.js';

const RESOURCES_TABLE = 'resources';
const CONSUMPTION_LOGS_TABLE = 'consumption_logs';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

export const listResources = async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from(RESOURCES_TABLE)
      .select('*')
      .order('category', { ascending: true });

    if (error) throw error;

    return res.json({ resources: data });
  } catch (error) {
    console.error('listResources error', error);
    return res.status(500).json({ message: 'Failed to fetch resources', error: error.message });
  }
};

export const getRecommendedResources = async (req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentLogs, error: logsError } = await supabase
      .from(CONSUMPTION_LOGS_TABLE)
      .select('category')
      .eq('user_id', req.user.id)
      .gte('logged_at', sevenDaysAgo.toISOString());

    if (logsError) throw logsError;

    const categoriesFromQuery = req.query.category ? req.query.category.split(',') : [];
    const logCategories = recentLogs?.map((log) => log.category).filter(Boolean) || [];

    const categories = [...new Set([...logCategories, ...categoriesFromQuery])];

    let query = supabase.from(RESOURCES_TABLE).select('*');
    if (categories.length) {
      query = query.in('category', categories);
    }

    const { data, error } = await query.limit(10);
    if (error) throw error;

    const recommendations = data.map((resource) => ({
      ...resource,
      reason: categories.length
        ? `Related to: ${categories.join(', ')}`
        : 'General sustainable practice',
    }));

    return res.json({ recommendations });
  } catch (error) {
    console.error('getRecommendedResources error', error);
    return res.status(500).json({ message: 'Failed to fetch recommendations', error: error.message });
  }
};

