import { supabase } from '../config/supabaseClient.js';
import { createOpenAIClient } from '../config/openaiClient.js';
import { getUserId } from '../middleware/flexibleAuth.js';

const CONSUMPTION_LOGS_TABLE = 'consumption_logs';
const USER_INVENTORY_TABLE = 'user_inventory';
const USERS_TABLE = 'users';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

// Helper function to get date ranges
const getDateRange = (period) => {
  const now = new Date();
  const start = new Date();

  switch (period) {
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      break;
    default:
      start.setDate(now.getDate() - 7); // default to week
  }

  return { start: start.toISOString(), end: now.toISOString() };
};

// Helper function to categorize food items
const getFoodCategory = (category) => {
  const categoryMap = {
    'Fruits': ['fruit', 'fruits', 'apple', 'banana', 'orange', 'berries'],
    'Vegetables': ['vegetable', 'vegetables', 'leafy', 'greens', 'carrot', 'broccoli', 'spinach'],
    'Proteins': ['meat', 'chicken', 'fish', 'eggs', 'dairy', 'cheese', 'milk', 'protein'],
    'Grains': ['rice', 'wheat', 'bread', 'pasta', 'cereal', 'grain'],
    'Snacks': ['snack', 'chips', 'cookies', 'candy', 'nuts'],
    'Beverages': ['drink', 'beverage', 'juice', 'soda', 'water'],
    'Other': []
  };

  const lowerCategory = category?.toLowerCase() || '';
  for (const [mainCategory, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => lowerCategory.includes(keyword))) {
      return mainCategory;
    }
  }
  return 'Other';
};

export const getConsumptionPatterns = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  const { period = 'week' } = req.query;
  const { start, end } = getDateRange(period);

  try {
    // Get consumption logs for the period
    const { data: logs, error: logsError } = await supabase
      .from(CONSUMPTION_LOGS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', start)
      .lte('logged_at', end)
      .order('logged_at', { ascending: true });

    if (logsError) throw logsError;

    // Get current inventory for waste prediction
    const { data: inventory, error: inventoryError } = await supabase
      .from(USER_INVENTORY_TABLE)
      .select('id, custom_name, quantity, unit, category, expires_at, food_item:food_item_id(name)')
      .eq('user_id', userId);

    if (inventoryError) throw inventoryError;

    // Get user profile for dietary context
    const { data: profile, error: profileError } = await supabase
      .from(USERS_TABLE)
      .select('household_size, dietary_preferences, household_children, household_adults')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Process consumption patterns
    const patterns = processConsumptionPatterns(logs || [], inventory || [], profile);
    const wastePredictions = predictWasteRisk(inventory || [], logs || []);
    const insights = generateDietaryInsights(patterns, profile);

    return res.json({
      patterns,
      wastePredictions,
      insights,
      period: {
        start,
        end,
        type: period
      }
    });
  } catch (error) {
    console.error('getConsumptionPatterns error', error);
    return res.status(500).json({ message: 'Failed to analyze consumption patterns', error: error.message });
  }
};

const processConsumptionPatterns = (logs, inventory, profile) => {
  const dailyConsumption = {};
  const categoryConsumption = {};
  const weeklyTrends = {};

  // Initialize days of the week
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  logs.forEach(log => {
    const date = new Date(log.logged_at);
    const dayOfWeek = daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1]; // Convert to Monday-start
    const dateKey = date.toISOString().split('T')[0];
    const category = getFoodCategory(log.category);

    // Daily consumption
    if (!dailyConsumption[dateKey]) {
      dailyConsumption[dateKey] = { total: 0, categories: {} };
    }
    dailyConsumption[dateKey].total += log.quantity || 0;
    dailyConsumption[dateKey].categories[category] = (dailyConsumption[dateKey].categories[category] || 0) + (log.quantity || 0);

    // Category consumption
    categoryConsumption[category] = (categoryConsumption[category] || 0) + (log.quantity || 0);

    // Weekly trends
    if (!weeklyTrends[dayOfWeek]) {
      weeklyTrends[dayOfWeek] = { total: 0, categories: {} };
    }
    weeklyTrends[dayOfWeek].total += log.quantity || 0;
    weeklyTrends[dayOfWeek].categories[category] = (weeklyTrends[dayOfWeek].categories[category] || 0) + (log.quantity || 0);
  });

  return {
    dailyConsumption,
    categoryConsumption,
    weeklyTrends,
    totalConsumption: logs.reduce((sum, log) => sum + (log.quantity || 0), 0),
    averageDaily: Object.keys(dailyConsumption).length > 0 ?
      logs.reduce((sum, log) => sum + (log.quantity || 0), 0) / Object.keys(dailyConsumption).length : 0
  };
};

const predictWasteRisk = (inventory, logs) => {
  const predictions = [];
  const now = new Date();

  inventory.forEach(item => {
    if (!item.expires_at) return;

    const expiryDate = new Date(item.expires_at);
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    // Only consider items expiring within 7 days
    if (daysUntilExpiry > 7 || daysUntilExpiry < 0) return;

    // Calculate consumption rate for this category
    const category = getFoodCategory(item.category);
    const recentLogs = logs.filter(log => {
      const logDate = new Date(log.logged_at);
      const daysSinceLog = Math.ceil((now - logDate) / (1000 * 60 * 60 * 24));
      return daysSinceLog <= 7 && getFoodCategory(log.category) === category;
    });

    const avgDailyConsumption = recentLogs.length > 0 ?
      recentLogs.reduce((sum, log) => sum + (log.quantity || 0), 0) / 7 : 0;

    const predictedConsumption = avgDailyConsumption * daysUntilExpiry;
    const wasteRisk = Math.max(0, (item.quantity || 0) - predictedConsumption);

    if (wasteRisk > 0) {
      predictions.push({
        item: item.custom_name || item.food_item?.name || 'Unknown Item',
        category: item.category,
        currentQuantity: item.quantity || 0,
        unit: item.unit,
        daysUntilExpiry,
        predictedConsumption: Math.round(predictedConsumption * 10) / 10,
        wasteRisk: Math.round(wasteRisk * 10) / 10,
        riskLevel: wasteRisk > (item.quantity || 0) * 0.5 ? 'high' : wasteRisk > (item.quantity || 0) * 0.25 ? 'medium' : 'low'
      });
    }
  });

  return predictions.sort((a, b) => b.wasteRisk - a.wasteRisk);
};

const generateDietaryInsights = (patterns, profile) => {
  const insights = [];
  const totalConsumption = patterns.totalConsumption;
  const categoryConsumption = patterns.categoryConsumption;

  // Calculate percentages
  const categoryPercentages = {};
  Object.keys(categoryConsumption).forEach(category => {
    categoryPercentages[category] = (categoryConsumption[category] / totalConsumption) * 100;
  });

  // Vegetable intake check
  const vegetablePercentage = categoryPercentages['Vegetables'] || 0;
  if (vegetablePercentage < 20) {
    insights.push({
      type: 'warning',
      title: 'Low Vegetable Consumption',
      message: `Vegetables make up only ${vegetablePercentage.toFixed(1)}% of your consumption. Consider increasing vegetable intake for better nutrition.`,
      category: 'balance'
    });
  }

  // Fruit intake check
  const fruitPercentage = categoryPercentages['Fruits'] || 0;
  if (fruitPercentage < 15) {
    insights.push({
      type: 'info',
      title: 'Limited Fruit Intake',
      message: `Fruits represent ${fruitPercentage.toFixed(1)}% of consumption. Fresh fruits provide essential vitamins and fiber.`,
      category: 'balance'
    });
  }

  // Protein balance check
  const proteinPercentage = categoryPercentages['Proteins'] || 0;
  if (proteinPercentage > 40) {
    insights.push({
      type: 'info',
      title: 'High Protein Focus',
      message: `Proteins account for ${proteinPercentage.toFixed(1)}% of consumption. Ensure balanced intake of other food groups.`,
      category: 'balance'
    });
  }

  // Weekly patterns
  const weeklyTrends = patterns.weeklyTrends;
  const weekendDays = ['Friday', 'Saturday', 'Sunday'];
  const weekdayDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];

  const weekendAvg = weekendDays.reduce((sum, day) => sum + (weeklyTrends[day]?.total || 0), 0) / weekendDays.length;
  const weekdayAvg = weekdayDays.reduce((sum, day) => sum + (weeklyTrends[day]?.total || 0), 0) / weekdayDays.length;

  if (weekendAvg > weekdayAvg * 1.5) {
    insights.push({
      type: 'info',
      title: 'Weekend Consumption Spike',
      message: `Consumption is ${((weekendAvg / weekdayAvg) - 1).toFixed(1)}x higher on weekends compared to weekdays.`,
      category: 'pattern'
    });
  }

  // Household size consideration
  const householdSize = profile.household_size || 1;
  const avgDailyPerPerson = patterns.averageDaily / householdSize;

  if (avgDailyPerPerson < 2) {
    insights.push({
      type: 'warning',
      title: 'Low Daily Consumption',
      message: `Average daily consumption per person is ${avgDailyPerPerson.toFixed(1)} units. Consider if this meets nutritional needs.`,
      category: 'quantity'
    });
  }

  return insights;
};

export const getHeatmapData = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  const { period = 'month' } = req.query;
  const { start, end } = getDateRange(period);

  try {
    const { data: logs, error } = await supabase
      .from(CONSUMPTION_LOGS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', start)
      .lte('logged_at', end)
      .order('logged_at', { ascending: true });

    if (error) throw error;

    // Create heatmap data structure
    const heatmap = {};
    const categories = new Set();

    logs.forEach(log => {
      const date = new Date(log.logged_at);
      const dateKey = date.toISOString().split('T')[0];
      const category = getFoodCategory(log.category);

      categories.add(category);

      if (!heatmap[dateKey]) {
        heatmap[dateKey] = {};
      }

      heatmap[dateKey][category] = (heatmap[dateKey][category] || 0) + (log.quantity || 0);
    });

    // Convert to array format for frontend
    const heatmapArray = Object.entries(heatmap).map(([date, categories]) => ({
      date,
      ...categories
    }));

    return res.json({
      heatmap: heatmapArray,
      categories: Array.from(categories),
      period: { start, end, type: period }
    });
  } catch (error) {
    console.error('getHeatmapData error', error);
    return res.status(500).json({ message: 'Failed to generate heatmap data', error: error.message });
  }
};