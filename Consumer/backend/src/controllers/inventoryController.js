import { supabase } from '../config/supabaseClient.js';
import { getUserId } from '../middleware/flexibleAuth.js';
import { determineExpiryDate } from './uploadController.js';
import OpenAI from 'openai';

const USER_INVENTORY_TABLE = 'user_inventory';
const FOOD_ITEMS_TABLE = 'food_items';
const STORE_PRODUCTS_TABLE = 'products';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

const inventorySelect = `
  id,
  user_id,
  quantity,
  unit,
  price,
  category,
  purchased_at,
  expires_at,
  notes,
  custom_name,
  food_item:food_item_id (
    id,
    name,
    category,
    expiration_days,
    sample_cost
  )
`;

export const listInventory = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { category, expiringBefore } = req.query;

  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found' });
    }

    let query = supabase
      .from(USER_INVENTORY_TABLE)
      .select(inventorySelect)
      .eq('user_id', userId)
      .order('expires_at', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (expiringBefore) {
      query = query.lte('expires_at', expiringBefore);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ items: data });
  } catch (error) {
    console.error('listInventory error', error);
    return res.status(500).json({ message: 'Failed to fetch inventory', error: error.message });
  }
};

export const addInventoryItem = async (req, res) => {
  if (!ensureSupabase(res)) return;

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
    return res.status(400).json({ message: 'Either a food item reference or a custom name is required' });
  }

  try {
    let resolvedCategory = category;
    if (!resolvedCategory && foodItemId) {
      const { data: foodItem, error: foodError } = await supabase
        .from(FOOD_ITEMS_TABLE)
        .select('category')
        .eq('id', foodItemId)
        .single();

      if (foodError) throw foodError;
      resolvedCategory = foodItem?.category;
    }

    if (!resolvedCategory) {
      return res.status(400).json({ message: 'Category is required for inventory items' });
    }

    // Determine expiry date if not provided
    let finalExpiresAt = expiresAt;
    if (!finalExpiresAt) {
      const itemName = customName || (foodItemId ? await supabase
        .from(FOOD_ITEMS_TABLE)
        .select('name')
        .eq('id', foodItemId)
        .single().then(({ data }) => data?.name) : null);

      if (itemName) {
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

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found' });
    }

    const { data, error } = await supabase
      .from(USER_INVENTORY_TABLE)
      .insert({
        user_id: userId,
        food_item_id: foodItemId,
        custom_name: customName,
        quantity,
        unit,
        category: resolvedCategory,
        purchased_at: purchasedAt,
        expires_at: finalExpiresAt,
        notes,
        price: parsedPrice,
      })
      .select(inventorySelect)
      .single();

    if (error) throw error;

    return res.status(201).json({ item: data });
  } catch (error) {
    console.error('addInventoryItem error', error);
    return res.status(500).json({ message: 'Failed to add inventory item', error: error.message });
  }
};

export const updateInventoryItem = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const updates = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(updates, 'price')) {
      const parsedPrice =
        updates.price === undefined || updates.price === null || updates.price === ''
          ? null
          : Number(updates.price);

      if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
        return res.status(400).json({ message: 'Price must be a positive number' });
      }

      updates.price = parsedPrice;
    }

    const { data, error } = await supabase
      .from(USER_INVENTORY_TABLE)
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(inventorySelect)
      .single();

    if (error) throw error;

    return res.json({ item: data });
  } catch (error) {
    console.error('updateInventoryItem error', error);
    return res.status(500).json({ message: 'Failed to update inventory item', error: error.message });
  }
};

export const removeInventoryItem = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const { error } = await supabase
      .from(USER_INVENTORY_TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    return res.status(204).send();
  } catch (error) {
    console.error('removeInventoryItem error', error);
    return res.status(500).json({ message: 'Failed to delete inventory item', error: error.message });
  }
};

export const getInventorySummary = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const { data, error } = await supabase
      .from(USER_INVENTORY_TABLE)
      .select('id, expires_at')
      .eq('user_id', userId);

    if (error) throw error;

    const totalItems = data.length;
    const expiringSoon = data.filter((item) => {
      if (!item.expires_at) return false;
      const expiresAt = new Date(item.expires_at);
      const inThreeDays = new Date();
      inThreeDays.setDate(inThreeDays.getDate() + 3);
      return expiresAt <= inThreeDays;
    }).length;

    return res.json({ totalItems, expiringSoon });
  } catch (error) {
    console.error('getInventorySummary error', error);
    return res.status(500).json({ message: 'Failed to summarize inventory', error: error.message });
  }
};

export const updateMissingExpiryDates = async (req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    // Get all items without expiry dates
    const { data: itemsWithoutExpiry, error: fetchError } = await supabase
      .from(USER_INVENTORY_TABLE)
      .select('id, custom_name, food_item:food_item_id(name, category), category')
      .eq('user_id', req.user.id)
      .is('expires_at', null);

    if (fetchError) throw fetchError;

    let updatedCount = 0;
    for (const item of itemsWithoutExpiry) {
      const itemName = item.custom_name || item.food_item?.name;
      if (itemName) {
        const expiryDate = await determineExpiryDate(itemName, item.category);
        if (expiryDate) {
          const { error: updateError } = await supabase
            .from(USER_INVENTORY_TABLE)
            .update({ expires_at: expiryDate })
            .eq('id', item.id)
            .eq('user_id', req.user.id);

          if (!updateError) {
            updatedCount++;
          }
        }
      }
    }

    return res.json({ message: `Updated expiry dates for ${updatedCount} items` });
  } catch (error) {
    console.error('updateMissingExpiryDates error', error);
    return res.status(500).json({ message: 'Failed to update expiry dates', error: error.message });
  }
};

// AI-powered cost-saving alternatives
export const getAlternatives = async (req, res) => {
  if (!ensureSupabase(res)) return;

  if (!openai) {
    return res.status(500).json({ message: 'OpenAI API key not configured' });
  }

  const { itemName } = req.params;
  const { category: categoryQuery, price: priceQuery } = req.query;

  if (!itemName) {
    return res.status(400).json({ message: 'Item name is required' });
  }

  try {
    const normalizedCategory =
      typeof categoryQuery === 'string' && categoryQuery.trim().length ? categoryQuery.trim() : null;
    const parsedPrice = priceQuery !== undefined ? Number(priceQuery) : null;
    const normalizedPrice =
      parsedPrice !== null && !Number.isNaN(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null;

    let aiAlternatives = [];

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are a grocery pricing expert in Bangladesh. Generate up to 4 cheaper alternative foods that provide similar nutritional value but cost less. Return STRICT JSON (no markdown) as an array of objects with this schema:

[
  {
    "name": "Alternative Food Name",
    "price": 150.00,
    "unit": "kg",
    "category": "Food Category",
    "calories": 200,
    "savings": 50.00,
    "reason": "why this is a good cheaper alternative"
  }
]

Rules for Bangladesh market (BDT prices):
- Prices must be realistic for Bangladesh markets in 2024
- Use appropriate units (kg, liter, pcs, dozen, etc.)
- Calculate savings as the difference from the target price
- Focus on commonly available, affordable alternatives
- Keep reasons concise (max 20 words)
- Ensure prices are in BDT (Bangladeshi Taka)
- Categories: Vegetables, Fruits, Dairy, Protein, Grain, Pantry, Snacks, Beverage, Frozen, Other`,
          },
          {
            role: 'user',
            content: `Generate cheaper alternatives for: "${itemName}"
Target price: BDT ${normalizedPrice ?? 'Unknown'}
Category: ${normalizedCategory || 'Unknown'}

Provide 3-4 alternatives with realistic Bangladesh market prices in BDT.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      const content = response.choices[0].message.content?.trim();
      if (content) {
        const jsonString = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
          aiAlternatives = parsed;
        }
      }
    } catch (aiError) {
      console.warn('AI alternatives generation failed, falling back to deterministic suggestions', aiError);
    }

    if (aiAlternatives.length > 0) {
      // Validate and format AI-generated alternatives
      const validatedAlternatives = aiAlternatives
        .map((alt, index) => {
          if (!alt?.name || !alt?.price) {
            return null;
          }
          return {
            product_id: `ai-generated-${index}`,
            name: alt.name,
            category: alt.category || 'Other',
            price: Number(alt.price) || null,
            unit: alt.unit || 'pcs',
            description: alt.reason || 'AI-generated alternative',
            stock_quantity: 999, // Unlimited for AI suggestions
            match_score: Math.max(70, 95 - index * 5), // High scores for AI suggestions
            reason: alt.reason || 'Cheaper alternative with similar nutrition',
            calories: alt.calories || 0,
            savings: alt.savings || 0,
          };
        })
        .filter(Boolean);

      if (validatedAlternatives.length > 0) {
        return res.json({ alternatives: validatedAlternatives });
      }
    }

    // Fallback to deterministic suggestions if AI fails
    const fallbackAlternatives = generateFallbackAlternatives(itemName, normalizedPrice);
    return res.json({ alternatives: fallbackAlternatives });

  } catch (error) {
    console.error('getAlternatives error', error);
    return res.status(500).json({ message: 'Failed to generate alternatives', error: error.message });
  }
};

// Fallback alternatives with BDT prices when AI fails
function generateFallbackAlternatives(itemName, targetPrice) {
  // Mock alternative foods with realistic Bangladesh BDT prices
  const alternativesMap = {
    'chicken breast': [
      {
        name: 'Chicken Thigh',
        price: 420.00,
        unit: 'kg',
        category: 'Protein',
        calories: 180,
        savings: targetPrice ? Math.max(0, targetPrice - 420) : 144.00,
        reason: 'Similar protein content, more affordable'
      },
      {
        name: 'Turkey Breast',
        price: 480.00,
        unit: 'kg',
        category: 'Protein',
        calories: 160,
        savings: targetPrice ? Math.max(0, targetPrice - 480) : 84.00,
        reason: 'Lean protein alternative, good value'
      },
      {
        name: 'Eggs (6-pack)',
        price: 300.00,
        unit: 'pcs',
        category: 'Protein',
        calories: 420,
        savings: targetPrice ? Math.max(0, targetPrice - 300) : 264.00,
        reason: 'High protein, very cost-effective'
      }
    ],
    'beef steak': [
      {
        name: 'Ground Beef (80% lean)',
        price: 540.00,
        unit: 'kg',
        category: 'Protein',
        calories: 250,
        savings: targetPrice ? Math.max(0, targetPrice - 540) : 300.00,
        reason: 'Good protein content, much cheaper per lb'
      },
      {
        name: 'Chicken Breast',
        price: 479.00,
        unit: 'kg',
        category: 'Protein',
        calories: 165,
        savings: targetPrice ? Math.max(0, targetPrice - 479) : 361.00,
        reason: 'Lean protein alternative, significant savings'
      },
      {
        name: 'Lentils (1 lb)',
        price: 180.00,
        unit: 'kg',
        category: 'Protein',
        calories: 680,
        savings: targetPrice ? Math.max(0, targetPrice - 180) : 540.00,
        reason: 'Plant-based protein, very affordable'
      }
    ],
    'salmon fillet': [
      {
        name: 'Canned Tuna',
        price: 239.00,
        unit: 'can',
        category: 'Protein',
        calories: 120,
        savings: targetPrice ? Math.max(0, targetPrice - 239) : 361.00,
        reason: 'Omega-3 rich, very cost-effective'
      },
      {
        name: 'Tilapia Fillet',
        price: 599.00,
        unit: 'kg',
        category: 'Protein',
        calories: 130,
        savings: targetPrice ? Math.max(0, targetPrice - 599) : 1.00,
        reason: 'Mild white fish, similar texture'
      },
      {
        name: 'Eggs (12-pack)',
        price: 479.00,
        unit: 'pcs',
        category: 'Protein',
        calories: 840,
        savings: targetPrice ? Math.max(0, targetPrice - 479) : 121.00,
        reason: 'High protein, excellent value'
      }
    ],
    'avocado': [
      {
        name: 'Banana',
        price: 60.00,
        unit: 'kg',
        category: 'Fruit',
        calories: 105,
        savings: targetPrice ? Math.max(0, targetPrice - 60) : 120.00,
        reason: 'Healthy fats, potassium rich, very affordable'
      },
      {
        name: 'Peanut Butter (2 tbsp)',
        price: 90.00,
        unit: 'serving',
        category: 'Pantry',
        calories: 190,
        savings: targetPrice ? Math.max(0, targetPrice - 90) : 90.00,
        reason: 'Healthy fats, good calories per dollar'
      },
      {
        name: 'Olive Oil (1 tbsp)',
        price: 36.00,
        unit: 'serving',
        category: 'Pantry',
        calories: 120,
        savings: targetPrice ? Math.max(0, targetPrice - 36) : 144.00,
        reason: 'Healthy fats, very cost-effective'
      }
    ],
    'almonds': [
      {
        name: 'Peanuts',
        price: 180.00,
        unit: 'kg',
        category: 'Snacks',
        calories: 160,
        savings: targetPrice ? Math.max(0, targetPrice - 180) : 120.00,
        reason: 'Similar nutrition, much cheaper'
      },
      {
        name: 'Sunflower Seeds',
        price: 240.00,
        unit: 'kg',
        category: 'Snacks',
        calories: 140,
        savings: targetPrice ? Math.max(0, targetPrice - 240) : 60.00,
        reason: 'Healthy fats, good protein content'
      },
      {
        name: 'Oatmeal (1 cup cooked)',
        price: 90.00,
        unit: 'serving',
        category: 'Grain',
        calories: 150,
        savings: targetPrice ? Math.max(0, targetPrice - 90) : 210.00,
        reason: 'Complex carbs, very affordable'
      }
    ],
    'greek yogurt': [
      {
        name: 'Regular Yogurt',
        price: 300.00,
        unit: 'kg',
        category: 'Dairy',
        calories: 150,
        savings: targetPrice ? Math.max(0, targetPrice - 300) : 180.00,
        reason: 'Similar protein, much cheaper'
      },
      {
        name: 'Cottage Cheese',
        price: 359.00,
        unit: 'kg',
        category: 'Dairy',
        calories: 160,
        savings: targetPrice ? Math.max(0, targetPrice - 359) : 121.00,
        reason: 'High protein, good value'
      },
      {
        name: 'Eggs (4-pack)',
        price: 180.00,
        unit: 'pcs',
        category: 'Protein',
        calories: 280,
        savings: targetPrice ? Math.max(0, targetPrice - 180) : 300.00,
        reason: 'High protein, excellent value'
      }
    ],
    'quinoa': [
      {
        name: 'Brown Rice',
        price: 180.00,
        unit: 'kg',
        category: 'Grain',
        calories: 215,
        savings: targetPrice ? Math.max(0, targetPrice - 180) : 120.00,
        reason: 'Complex carbs, very affordable'
      },
      {
        name: 'Oats',
        price: 240.00,
        unit: 'kg',
        category: 'Grain',
        calories: 150,
        savings: targetPrice ? Math.max(0, targetPrice - 240) : 60.00,
        reason: 'Nutritious grains, good value'
      },
      {
        name: 'Lentils',
        price: 150.00,
        unit: 'kg',
        category: 'Protein',
        calories: 230,
        savings: targetPrice ? Math.max(0, targetPrice - 150) : 150.00,
        reason: 'Plant protein, excellent value'
      }
    ]
  };

  // Default alternatives for unknown items
  const defaultAlternatives = [
    {
      name: 'Generic Alternative 1',
      price: 240.00,
      unit: 'kg',
      category: 'Other',
      calories: 150,
      savings: targetPrice ? Math.max(0, targetPrice - 240) : 180.00,
      reason: 'Cost-effective alternative with similar nutritional value'
    },
    {
      name: 'Generic Alternative 2',
      price: 210.00,
      unit: 'kg',
      category: 'Other',
      calories: 180,
      savings: targetPrice ? Math.max(0, targetPrice - 210) : 210.00,
      reason: 'Budget-friendly option with good calorie density'
    },
    {
      name: 'Generic Alternative 3',
      price: 150.00,
      unit: 'kg',
      category: 'Other',
      calories: 120,
      savings: targetPrice ? Math.max(0, targetPrice - 150) : 270.00,
      reason: 'Very affordable choice with reasonable calories'
    }
  ];

  const itemKey = itemName.toLowerCase();
  const alternatives = alternativesMap[itemKey] || defaultAlternatives;

  return alternatives.slice(0, 4).map((alt, index) => ({
    product_id: `fallback-${index}`,
    name: alt.name,
    category: alt.category,
    price: alt.price,
    unit: alt.unit,
    description: alt.reason,
    stock_quantity: 999,
    match_score: Math.max(60, 85 - index * 5),
    reason: alt.reason,
    calories: alt.calories,
    savings: alt.savings,
  }));
}

