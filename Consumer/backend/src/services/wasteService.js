import { supabase } from '../config/supabaseClient.js';
import { createOpenAIClient } from '../config/openaiClient.js';
import { enableWasteCollection, replaceWasteList, fetchFarmerPackage } from './agrisenseService.js';

const WASTE_TABLE = 'user_waste_materials';
const WASTE_PICKUPS_TABLE = 'waste_pickups';
const MIN_REWARD_POINTS = 5;
const POINTS_PER_KG = 8; // 8 pts per kg ≈ 0.008 pts per gram
const PICKUP_STATUSES = new Set(['pending', 'scheduled', 'completed', 'cancelled']);

const convertQuantityToGrams = (value, unit) => {
  const normalizedUnit = (unit || '').toLowerCase().trim();
  const numValue = Number(value) || 0;

  if (normalizedUnit === 'kg' || normalizedUnit === 'kilogram') return numValue * 1000;
  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') return numValue;
  if (normalizedUnit === 'ml' || normalizedUnit === 'milliliter') return numValue; // Approximate density
  if (normalizedUnit === 'l' || normalizedUnit === 'liter') return numValue * 1000;
  if (normalizedUnit === 'ton' || normalizedUnit === 'tons' || normalizedUnit === 'tonne') return numValue * 1_000_000;
  return numValue * 50; // Default assumption for unknown units
};

const estimateValuePerGram = (category) => {
  const categoryLower = (category || 'general').toLowerCase();

  if (categoryLower.includes('compost') || categoryLower.includes('vegetable')) return 0.02;
  if (categoryLower.includes('protein') || categoryLower.includes('meat')) return 0.15;
  if (categoryLower.includes('grain') || categoryLower.includes('rice')) return 0.05;
  if (categoryLower.includes('fruit')) return 0.03;
  if (categoryLower.includes('dairy')) return 0.08;
  return 0.04;
};

const ensureSupabaseClient = () => {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
};

const fetchWasteItems = async (userId) => {
  ensureSupabaseClient();

  const { data, error } = await supabase
    .from(WASTE_TABLE)
    .select(
      `id, user_id, material_name, quantity_value, quantity_unit, source_item_name, source_category, last_source_quantity, metadata, updated_at, created_at`,
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchUserWasteProfile = async (userId) => {
  ensureSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select(
      'id, full_name, phone, location, budget_amount_bdt, budget_period, agrisense_waste_enabled, reward_points',
    )
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
};

const formatWasteForAgrisense = (items = []) => {
  return items
    .map((item) => ({
      waste_name: item.material_name,
      amount: Number(item.quantity_value ?? 0),
      unit: item.quantity_unit || 'units',
    }))
    .filter(
      (row) =>
        typeof row.waste_name === 'string' &&
        row.waste_name.trim().length > 0 &&
        !Number.isNaN(row.amount),
    );
};

const summarizeWasteItems = (items = []) => {
  return items.reduce(
    (acc, item) => {
      const quantity = Number(item.quantity_value ?? 0);
      acc.totalQuantity += quantity;
      acc.totalWeightGrams += convertQuantityToGrams(item.quantity_value, item.quantity_unit);
      return acc;
    },
    { totalItems: items.length, totalQuantity: 0, totalWeightGrams: 0 },
  );
};

const calculateRewardPoints = (totalWeightGrams) => {
  const kilograms = totalWeightGrams / 1000;
  return Math.max(MIN_REWARD_POINTS, Math.round(kilograms * POINTS_PER_KG));
};

const syncAgrisenseWasteIfNeeded = async (userId, userProfile, wasteItems) => {
  if (!userProfile?.agrisense_waste_enabled) {
    return false;
  }

  const phoneNumber = userProfile?.phone;
  if (!phoneNumber) {
    console.warn('Skipping Agrisense sync because phone number is missing for user', userId);
    return false;
  }

  try {
    await replaceWasteList(phoneNumber, formatWasteForAgrisense(wasteItems));
    const { error } = await supabase
      .from('users')
      .update({ agrisense_last_sync: new Date().toISOString() })
      .eq('id', userId);
    if (error) {
      console.warn('Failed to update Agrisense sync timestamp', error);
    }
    return true;
  } catch (error) {
    console.error('Failed to sync waste data with Agrisense', error);
    return false;
  }
};

const buildWastePrompt = (usageContext, existingWaste, userBudget) => {
  const usageSummary = `
Incoming usage:
- Item: ${usageContext.itemName || 'Unknown'}
- Category: ${usageContext.category || 'Uncategorized'}
- Quantity: ${usageContext.quantity ?? 'unknown'} ${usageContext.unit || ''}
${userBudget ? `- Budget context: ${userBudget.budget_amount_bdt} BDT per ${userBudget.budget_period || 'month'}` : ''}
`.trim();

  const wasteSummary = existingWaste.length
    ? existingWaste
      .map(
        (item, index) =>
          `${index + 1}. ${item.material_name} — ${Number(item.quantity_value ?? 0)} ${item.quantity_unit || ''
          }`,
      )
      .join('\n')
    : 'None recorded.';

  return `
You are an assistant that helps families divert kitchen waste into agricultural inputs. Analyze how the current usage can produce reusable waste (compost, fertilizer, feed, etc.) and return structured JSON only.

${usageSummary}

${userBudget ? `Budget context: The household has a budget of ${userBudget.budget_amount_bdt} BDT per ${userBudget.budget_period || 'month'}. Consider the economic value of waste materials when making recommendations - waste that can be reused reduces future spending on agricultural inputs.` : ''}

Existing reusable waste inventory:
${wasteSummary}

Return ONLY valid JSON with this shape:
{
  "items": [
    {
      "name": "Banana peel compost",
      "quantity_value": 0.5,
      "quantity_unit": "kg",
      "action": "new"
    }
  ]
}

Rules:
- "action" must be either "new" (create a brand new waste item) or "add" (increase the quantity of an existing one).
- quantity_value must be a non-negative number (grams, kilograms, liters, etc.).
- quantity_unit should be a short plain-text unit (e.g., "g", "kg", "ml"). Use null if unknown.
- If no agriculturally helpful waste is produced, return { "items": [] }.
- Do not include explanations, markdown, or any other fields.
- Predict the quantity of the waste item that will be produced based on the usage context. Do not use the use amount to directly waste amount. Use your knowledge. 
`;
};

const callWasteModel = async (usageContext, existingWaste, userBudget) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured on server');
  }

  const client = createOpenAIClient();
  if (!client) {
    throw new Error('OpenAI client is not available');
  }

  const prompt = buildWastePrompt(usageContext, existingWaste, userBudget);

  const completion = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content:
          'You are a precision agricultural waste assistant. Always respond with strict JSON that follows the requested schema. Never output markdown or commentary.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const contentBlock = completion.output
    ?.flatMap((chunk) => chunk.content || [])
    ?.find((entry) => entry.type === 'output_text');

  const textPayload = contentBlock?.text?.trim();
  if (!textPayload) {
    throw new Error('OpenAI response missing JSON payload');
  }

  const parsed = JSON.parse(textPayload);
  if (!Array.isArray(parsed?.items)) {
    throw new Error('OpenAI response missing "items" array');
  }

  return parsed.items
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : null,
      quantity_value:
        item.quantity_value === null || item.quantity_value === undefined
          ? null
          : Number(item.quantity_value),
      quantity_unit: typeof item.quantity_unit === 'string' ? item.quantity_unit.trim() : null,
      action: item.action === 'add' || item.action === 'new' ? item.action : null,
    }))
    .filter(
      (item) =>
        item.name &&
        item.action &&
        item.quantity_value !== null &&
        !Number.isNaN(item.quantity_value) &&
        item.quantity_value >= 0,
    );
};

const persistWasteChanges = async (userId, recommendations, usageContext, existingWaste) => {
  const nowIso = new Date().toISOString();
  const existingMap = new Map(
    existingWaste.map((item) => [item.material_name.trim().toLowerCase(), item]),
  );

  const inserts = [];
  const updates = [];

  recommendations.forEach((rec) => {
    const key = rec.name.trim().toLowerCase();
    const existing = existingMap.get(key);

    if (rec.action === 'add' && existing) {
      updates.push({
        id: existing.id,
        quantity_value: Number(existing.quantity_value ?? 0) + Number(rec.quantity_value),
        quantity_unit: rec.quantity_unit || existing.quantity_unit || null,
      });
    } else if (rec.action === 'new' && existing) {
      // If AI marked as new but item exists, treat as add
      updates.push({
        id: existing.id,
        quantity_value: Number(existing.quantity_value ?? 0) + Number(rec.quantity_value),
        quantity_unit: rec.quantity_unit || existing.quantity_unit || null,
      });
    } else if (rec.action === 'add' && !existing) {
      inserts.push({
        material_name: rec.name,
        quantity_value: rec.quantity_value,
        quantity_unit: rec.quantity_unit,
      });
    } else {
      inserts.push({
        material_name: rec.name,
        quantity_value: rec.quantity_value,
        quantity_unit: rec.quantity_unit,
      });
    }
  });

  const insertedRecords = [];
  const updatedRecords = [];

  if (inserts.length) {
    const payload = inserts.map((row) => ({
      user_id: userId,
      material_name: row.material_name,
      quantity_value: row.quantity_value,
      quantity_unit: row.quantity_unit,
      source_item_name: usageContext.itemName || null,
      source_category: usageContext.category || null,
      last_source_quantity: usageContext.quantity ?? null,
      metadata: {
        last_action: 'new',
        model: 'gpt-4.1-mini',
      },
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const { data, error } = await supabase.from(WASTE_TABLE).insert(payload).select('*');
    if (error) throw error;
    insertedRecords.push(...(data || []));
    data?.forEach((record) => {
      const key = record.material_name.trim().toLowerCase();
      existingMap.set(key, record);
    });
  }

  for (const row of updates) {
    const { data, error } = await supabase
      .from(WASTE_TABLE)
      .update({
        quantity_value: row.quantity_value,
        quantity_unit: row.quantity_unit,
        source_item_name: usageContext.itemName || null,
        source_category: usageContext.category || null,
        last_source_quantity: usageContext.quantity ?? null,
        metadata: {
          last_action: 'add',
          model: 'gpt-4.1-mini',
        },
        updated_at: nowIso,
      })
      .eq('id', row.id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    updatedRecords.push(data);
    const key = data.material_name.trim().toLowerCase();
    existingMap.set(key, data);
  }

  return {
    inserted: insertedRecords,
    updated: updatedRecords,
    all: Array.from(existingMap.values()),
  };
};

export const analyzeUsageAndSyncWaste = async (userId, usageContext) => {
  ensureSupabaseClient();
  if (!userId) {
    throw new Error('User ID is required for waste analysis');
  }
  if (!usageContext?.itemName) {
    throw new Error('Item name is required for waste analysis');
  }

  let userProfile = null;
  try {
    userProfile = await fetchUserWasteProfile(userId);
  } catch (profileError) {
    console.warn('Failed to fetch user profile for waste analysis:', profileError);
  }

  const userBudget = userProfile
    ? {
        budget_amount_bdt: userProfile.budget_amount_bdt,
        budget_period: userProfile.budget_period,
      }
    : null;

  const existingWaste = await fetchWasteItems(userId);
  const recommendations = await callWasteModel(usageContext, existingWaste, userBudget);

  if (!recommendations.length) {
    return { recommendations: [], items: existingWaste };
  }

  const result = await persistWasteChanges(userId, recommendations, usageContext, existingWaste);
  await syncAgrisenseWasteIfNeeded(userId, userProfile, result.all);
  return {
    recommendations,
    items: result.all,
  };
};

export const getWasteItemsForUser = async (userId) => {
  return fetchWasteItems(userId);
};

/**
 * Calculate waste estimation metrics from historical patterns
 */
const calculateWasteEstimations = (wasteItems) => {
  if (!wasteItems || wasteItems.length === 0) {
    return {
      totalWasteGrams: 0,
      estimatedMoneyWasted: 0,
      weeklyProjection: 0,
      monthlyProjection: 0,
      topWasteCategories: [],
    };
  }

  let totalGrams = 0;
  let totalValue = 0;
  const categoryMap = new Map();

  wasteItems.forEach((item) => {
    const grams = convertToGrams(item.quantity_value, item.quantity_unit);
    const category = item.source_category || 'General';
    const valuePerGram = estimateValuePerGram(category);
    const itemValue = grams * valuePerGram;

    totalGrams += grams;
    totalValue += itemValue;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, { grams: 0, value: 0, count: 0 });
    }
    const catData = categoryMap.get(category);
    catData.grams += grams;
    catData.value += itemValue;
    catData.count += 1;
  });

  // Calculate weekly and monthly projections based on current data
  // Assume the data represents patterns over the last 30 days
  const daysOfData = 30; // Assumption
  const dailyAverage = totalGrams / daysOfData;
  const weeklyProjection = dailyAverage * 7;
  const monthlyProjection = dailyAverage * 30;

  // Top waste categories
  const topWasteCategories = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      grams: Math.round(data.grams),
      value: Math.round(data.value),
      count: data.count,
    }))
    .sort((a, b) => b.grams - a.grams)
    .slice(0, 5);

  return {
    totalWasteGrams: Math.round(totalGrams),
    estimatedMoneyWasted: Math.round(totalValue),
    weeklyProjection: Math.round(weeklyProjection),
    monthlyProjection: Math.round(monthlyProjection),
    topWasteCategories,
  };
};

/**
 * Generate community comparison data (dummy dataset for now)
 */
const generateCommunityComparison = (userEstimations) => {
  // Dummy community averages (BDT per month)
  const communityAverages = {
    small_household: { monthlyWaste: 1200, members: 2 },
    medium_household: { monthlyWaste: 2400, members: 4 },
    large_household: { monthlyWaste: 3800, members: 6 },
  };

  // Determine user's household size (dummy logic)
  const userMonthlyWaste = userEstimations.monthlyProjection;

  let comparison = 'average';
  let percentageDiff = 0;
  let communityAvg = communityAverages.medium_household.monthlyWaste;

  if (userMonthlyWaste < communityAvg * 0.8) {
    comparison = 'below';
    percentageDiff = Math.round(((communityAvg - userMonthlyWaste) / communityAvg) * 100);
  } else if (userMonthlyWaste > communityAvg * 1.2) {
    comparison = 'above';
    percentageDiff = Math.round(((userMonthlyWaste - communityAvg) / communityAvg) * 100);
  }

  return {
    comparison, // 'below', 'average', 'above'
    percentageDiff,
    communityAverage: communityAvg,
    userAverage: userMonthlyWaste,
  };
};

/**
 * Get comprehensive waste estimations for a user
 */
export const getWasteEstimations = async (userId) => {
  ensureSupabaseClient();

  const wasteItems = await fetchWasteItems(userId);
  const estimations = calculateWasteEstimations(wasteItems);
  const communityComparison = generateCommunityComparison(estimations);

  return {
    estimations,
    communityComparison,
    items: wasteItems,
  };
};

export const getAgrisenseStatusForUser = async (userId) => {
  ensureSupabaseClient();

  const { data: userProfile, error } = await supabase
    .from('users')
    .select(
      'phone, is_farming_interested, agrisense_waste_enabled, agrisense_farmer_id, agrisense_last_sync',
    )
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  let remoteData = null;
  if (userProfile?.agrisense_waste_enabled && userProfile?.phone) {
    try {
      remoteData = await fetchFarmerPackage(userProfile.phone);
    } catch (remoteError) {
      console.warn('Failed to fetch Agrisense farmer data', remoteError?.message || remoteError);
    }
  }

  const remoteWasteCount = Array.isArray(remoteData?.waste) ? remoteData.waste.length : 0;

  return {
    interested: Boolean(userProfile?.is_farming_interested),
    enabled: Boolean(userProfile?.agrisense_waste_enabled),
    phone: userProfile?.phone || null,
    lastSyncedAt: userProfile?.agrisense_last_sync || null,
    farmer:
      remoteData?.farmer ||
      (userProfile?.agrisense_farmer_id ? { id: userProfile.agrisense_farmer_id } : null),
    remoteWasteCount,
    statusNote: remoteData?.message || null,
  };
};

export const toggleAgrisenseIntegration = async (userId, enabled) => {
  ensureSupabaseClient();

  if (typeof enabled !== 'boolean') {
    const flagError = new Error('enabled flag must be a boolean');
    flagError.statusCode = 400;
    throw flagError;
  }

  const { data: userProfile, error } = await supabase
    .from('users')
    .select('phone, agrisense_waste_enabled, agrisense_farmer_id')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  if (!userProfile?.phone) {
    const phoneError = new Error('Please add a phone number to your profile before linking Agrisense');
    phoneError.statusCode = 400;
    throw phoneError;
  }

  if (enabled) {
    const enableResponse = await enableWasteCollection(userProfile.phone);
    const wasteItems = await fetchWasteItems(userId);
    await replaceWasteList(userProfile.phone, formatWasteForAgrisense(wasteItems));

    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_farming_interested: true,
        agrisense_waste_enabled: true,
        agrisense_farmer_id: enableResponse?.farmer?.id || userProfile.agrisense_farmer_id || null,
        agrisense_last_sync: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    const status = await getAgrisenseStatusForUser(userId);
    return {
      message: enableResponse?.message || 'Agrisense waste sharing enabled',
      status,
    };
  }

  const { error: disableError } = await supabase
    .from('users')
    .update({
      is_farming_interested: false,
      agrisense_waste_enabled: false,
    })
    .eq('id', userId);

  if (disableError) {
    throw disableError;
  }

  const status = await getAgrisenseStatusForUser(userId);
  return {
    message: 'Agrisense waste sharing disabled',
    status,
  };
};

export const listWastePickupsForUser = async (userId, options = {}) => {
  ensureSupabaseClient();

  const limit = options.limit && Number(options.limit) > 0 ? Number(options.limit) : 10;
  const { data, error } = await supabase
    .from(WASTE_PICKUPS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
};

export const requestWastePickup = async (userId) => {
  ensureSupabaseClient();

  if (!userId) {
    throw new Error('User ID is required to request a pickup');
  }

  const [wasteItems, userProfile] = await Promise.all([
    fetchWasteItems(userId),
    fetchUserWasteProfile(userId),
  ]);

  if (!wasteItems.length) {
    const emptyError = new Error('No reusable waste available to request pickup');
    emptyError.statusCode = 400;
    throw emptyError;
  }

  const summary = summarizeWasteItems(wasteItems);
  const rewardPoints = calculateRewardPoints(summary.totalWeightGrams);
  const nowIso = new Date().toISOString();

  const { data: pickup, error: insertError } = await supabase
    .from(WASTE_PICKUPS_TABLE)
    .insert({
      user_id: userId,
      status: 'pending',
      total_items: summary.totalItems,
      total_quantity: summary.totalQuantity,
      total_weight_grams: summary.totalWeightGrams,
      reward_points: rewardPoints,
      waste_snapshot: wasteItems,
      contact_name: userProfile?.full_name || null,
      contact_phone: userProfile?.phone || null,
      contact_location: userProfile?.location || null,
      requested_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (insertError) {
    throw insertError;
  }

  const { error: clearError } = await supabase.from(WASTE_TABLE).delete().eq('user_id', userId);
  if (clearError) {
    console.error('Failed to clear waste items after pickup request', clearError);
  }

  const baseReward = Number(userProfile?.reward_points || 0);
  const { data: rewardData, error: rewardError } = await supabase
    .from('users')
    .update({
      reward_points: baseReward + rewardPoints,
    })
    .eq('id', userId)
    .select('reward_points, agrisense_waste_enabled, phone')
    .single();

  if (rewardError) {
    console.warn('Failed to update reward points after pickup request', rewardError);
  }

  // Ensure Agrisense sees the cleared waste inventory
  if (userProfile) {
    await syncAgrisenseWasteIfNeeded(userId, userProfile, []);
  }

  const rewardTotal = rewardData?.reward_points ?? baseReward + rewardPoints;

  return {
    pickup,
    rewardPoints,
    rewardTotal,
  };
};

export const listWastePickupsForAdmin = async () => {
  ensureSupabaseClient();

  const { data, error } = await supabase
    .from(WASTE_PICKUPS_TABLE)
    .select(
      `
        id,
        user_id,
        status,
        total_items,
        total_quantity,
        total_weight_grams,
        reward_points,
        waste_snapshot,
        contact_name,
        contact_phone,
        contact_location,
        notes,
        requested_at,
        completed_at,
        created_at,
        updated_at,
        user:user_id (
          full_name,
          email,
          phone,
          location
        )
      `,
    )
    .order('requested_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

export const updateWastePickupStatus = async (pickupId, nextStatus, adminId) => {
  ensureSupabaseClient();

  if (!PICKUP_STATUSES.has(nextStatus)) {
    const statusError = new Error('Invalid pickup status');
    statusError.statusCode = 400;
    throw statusError;
  }

  const nowIso = new Date().toISOString();
  const updatePayload = {
    status: nextStatus,
    admin_id: adminId || null,
    updated_at: nowIso,
  };

  if (nextStatus === 'completed') {
    updatePayload.completed_at = nowIso;
  }

  const { data, error } = await supabase
    .from(WASTE_PICKUPS_TABLE)
    .update(updatePayload)
    .eq('id', pickupId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
};


