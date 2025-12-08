import { supabase } from '../config/supabaseClient.js';
import { determineExpiryDate } from './uploadController.js';
import { analyzeUsageAndSyncWaste } from '../services/wasteService.js';

const USERS_TABLE = 'users';
const USER_INVENTORY_TABLE = 'user_inventory';
const FOOD_ITEMS_TABLE = 'food_items';
const CONSUMPTION_LOGS_TABLE = 'consumption_logs';

const profileSelect = `
  id,
  full_name,
  email,
  phone,
  location,
  role,
  household_size,
  household_children,
  household_teens,
  household_adults,
  household_elderly,
  dietary_preferences,
  budget_amount_bdt,
  budget_period,
  reward_points,
  is_farming_interested,
  agrisense_waste_enabled,
  agrisense_farmer_id,
  created_at
`;

const inventorySelect = `
  id,
  user_id,
  food_item_id,
  custom_name,
  category,
  quantity,
  unit,
  price,
  purchased_at,
  expires_at,
  notes,
  created_at,
  food_item:food_item_id (
    id,
    name,
    category,
    expiration_days,
    sample_cost
  )
`;

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

const normalizePhone = (phone) => {
  if (typeof phone !== 'string' && typeof phone !== 'number') return '';
  return String(phone).trim();
};

const fetchUserByPhone = async (phone) => {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(profileSelect)
    .eq('phone', phone)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getProfileByPhone = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const normalizedPhone = normalizePhone(req.body?.phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const user = await fetchUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({ message: 'User not found for the provided phone number' });
    }

    const { data: inventory, error: inventoryError } = await supabase
      .from(USER_INVENTORY_TABLE)
      .select(inventorySelect)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (inventoryError) throw inventoryError;

    return res.json({
      profile: user,
      inventory,
    });
  } catch (error) {
    console.error('getProfileByPhone error', error);
    return res.status(500).json({ message: 'Failed to fetch profile by phone', error: error.message });
  }
};

export const addInventoryByPhone = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const normalizedPhone = normalizePhone(req.body?.phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  const {
    foodItemId,
    customName,
    quantity,
    unit,
    category,
    purchasedAt,
    expiresAt,
    notes,
    price,
  } = req.body;

  if (!foodItemId && !customName) {
    return res.status(400).json({ message: 'Either foodItemId or customName must be provided' });
  }

  if (quantity !== undefined && (Number.isNaN(Number(quantity)) || Number(quantity) < 0)) {
    return res.status(400).json({ message: 'Quantity must be a valid non-negative number' });
  }

  try {
    const user = await fetchUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({ message: 'User not found for the provided phone number' });
    }

    let resolvedCategory = category;
    if (!resolvedCategory && foodItemId) {
      const { data: foodItem, error: foodError } = await supabase
        .from(FOOD_ITEMS_TABLE)
        .select('category')
        .eq('id', foodItemId)
        .maybeSingle();

      if (foodError) throw foodError;
      resolvedCategory = foodItem?.category;
    }

    if (!resolvedCategory) {
      return res.status(400).json({ message: 'Category is required for inventory items' });
    }

    let finalExpiresAt = expiresAt;
    if (!finalExpiresAt) {
      const itemName = customName;
      if (!itemName && foodItemId) {
        const { data: foodItemName, error: foodNameError } = await supabase
          .from(FOOD_ITEMS_TABLE)
          .select('name')
          .eq('id', foodItemId)
          .maybeSingle();
        if (foodNameError) throw foodNameError;
        finalExpiresAt = await determineExpiryDate(foodItemName?.name, resolvedCategory);
      } else if (itemName) {
        finalExpiresAt = await determineExpiryDate(itemName, resolvedCategory);
      }
    }

    const parsedPrice =
      price === undefined || price === null || price === ''
        ? null
        : Number(price);

    if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      return res.status(400).json({ message: 'Price must be a positive number' });
    }

    const insertPayload = {
      user_id: user.id,
      food_item_id: foodItemId || null,
      custom_name: customName || null,
      quantity: quantity === undefined ? null : Number(quantity),
      unit: unit || null,
      category: resolvedCategory,
      purchased_at: purchasedAt || new Date().toISOString(),
      expires_at: finalExpiresAt || null,
      notes: notes || null,
      price: parsedPrice,
    };

    const { data, error } = await supabase
      .from(USER_INVENTORY_TABLE)
      .insert(insertPayload)
      .select(inventorySelect)
      .single();

    if (error) throw error;

    return res.status(201).json({ item: data });
  } catch (error) {
    console.error('addInventoryByPhone error', error);
    return res.status(500).json({ message: 'Failed to add inventory via phone', error: error.message });
  }
};

export const logUsageByPhone = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const normalizedPhone = normalizePhone(req.body?.phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  const {
    itemName,
    category,
    quantity,
    unit,
    notes,
    loggedAt,
    inventoryItemId,
  } = req.body;

  if (!inventoryItemId && (!itemName || !category)) {
    return res.status(400).json({ message: 'Item name and category are required when inventoryItemId is missing' });
  }

  if (!quantity || Number.isNaN(Number(quantity)) || Number(quantity) <= 0) {
    return res.status(400).json({ message: 'Quantity must be a positive number' });
  }

  try {
    const user = await fetchUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({ message: 'User not found for the provided phone number' });
    }

    let logItemName = itemName;
    let logCategory = category;
    let logUnit = unit;
    let inventoryReference = null;
    let inventoryRemaining = null;

    if (inventoryItemId) {
      const { data: inventoryItem, error: inventoryError } = await supabase
        .from(USER_INVENTORY_TABLE)
        .select(`
          id,
          user_id,
          quantity,
          unit,
          category,
          custom_name,
          food_item_id,
          food_item:food_item_id ( name )
        `)
        .eq('id', inventoryItemId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (inventoryError) throw inventoryError;
      if (!inventoryItem) {
        return res.status(404).json({ message: 'Inventory item not found for this user' });
      }

      if (inventoryItem.quantity == null) {
        return res.status(400).json({ message: 'Inventory quantity is not set for this item' });
      }

      const usageQuantity = Number(quantity);
      if (usageQuantity > Number(inventoryItem.quantity)) {
        return res.status(400).json({ message: 'Usage exceeds available inventory' });
      }

      inventoryRemaining = Number(inventoryItem.quantity) - usageQuantity;
      logItemName = inventoryItem.custom_name || inventoryItem.food_item?.name || logItemName;
      logCategory = inventoryItem.category || logCategory || 'Custom';
      logUnit = inventoryItem.unit || logUnit;
      inventoryReference = inventoryItemId;
    }

    const { data, error } = await supabase
      .from(CONSUMPTION_LOGS_TABLE)
      .insert({
        user_id: user.id,
        inventory_item_id: inventoryReference,
        item_name: logItemName,
        category: logCategory,
        quantity: Number(quantity),
        unit: logUnit,
        notes,
        logged_at: loggedAt || new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    if (inventoryReference && inventoryRemaining !== null) {
      if (inventoryRemaining <= 0) {
        const { error: deleteError } = await supabase
          .from(USER_INVENTORY_TABLE)
          .delete()
          .eq('id', inventoryReference)
          .eq('user_id', user.id);
        if (deleteError) throw deleteError;
      } else {
        const { error: updateError } = await supabase
          .from(USER_INVENTORY_TABLE)
          .update({ quantity: inventoryRemaining })
          .eq('id', inventoryReference)
          .eq('user_id', user.id);
        if (updateError) throw updateError;
      }
    }

    analyzeUsageAndSyncWaste(user.id, {
      itemName: logItemName,
      category: logCategory,
      quantity: Number(quantity),
      unit: logUnit,
    }).catch((wasteError) => {
      console.error('Waste analysis failed after public usage log:', wasteError);
    });

    return res.status(201).json({ log: data });
  } catch (error) {
    console.error('logUsageByPhone error', error);
    return res.status(500).json({ message: 'Failed to log usage via phone', error: error.message });
  }
};


