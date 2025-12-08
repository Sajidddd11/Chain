import { supabase } from '../config/supabaseClient.js';
import { createOpenAIClient } from '../config/openaiClient.js';
import { getUserId } from '../middleware/flexibleAuth.js';
import { analyzeUsageAndSyncWaste } from '../services/wasteService.js';

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

export const listLogs = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    const { data, error } = await supabase
      .from(CONSUMPTION_LOGS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false });

    if (error) throw error;

    return res.json({ logs: data });
  } catch (error) {
    console.error('listLogs error', error);
    return res.status(500).json({ message: 'Failed to fetch logs', error: error.message });
  }
};

export const addLog = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
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

  try {
    let logItemName = itemName;
    let logCategory = category;
    let logUnit = unit;
    let logQuantity = quantity;
    let inventoryReference = null;

    let inventoryRemaining = null;

    if (inventoryItemId) {
      const usageQuantity = Number(quantity);
      if (!quantity || Number.isNaN(usageQuantity) || usageQuantity <= 0) {
        return res.status(400).json({ message: 'Usage quantity must be a positive number' });
      }

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
        .eq('user_id', userId)
        .single();

      if (inventoryError) throw inventoryError;
      if (!inventoryItem) {
        return res.status(404).json({ message: 'Inventory item not found' });
      }

      if (inventoryItem.quantity == null) {
        return res.status(400).json({ message: 'Inventory quantity is not set for this item' });
      }

      if (usageQuantity > Number(inventoryItem.quantity)) {
        return res.status(400).json({ message: 'Usage exceeds available inventory' });
      }

      const remaining = Number(inventoryItem.quantity) - usageQuantity;
      logItemName = inventoryItem.custom_name || inventoryItem.food_item?.name || itemName;
      logCategory = inventoryItem.category || category || 'Custom';
      logUnit = inventoryItem.unit || unit;
      logQuantity = usageQuantity;
      inventoryReference = inventoryItemId;
      inventoryRemaining = remaining;
    } else {
      if (!itemName || !category) {
        return res.status(400).json({ message: 'Item name and category are required' });
      }
    }

    const { data, error } = await supabase
      .from(CONSUMPTION_LOGS_TABLE)
      .insert({
        user_id: userId,
        inventory_item_id: inventoryReference,
        item_name: logItemName,
        category: logCategory,
        quantity: logQuantity,
        unit: logUnit,
        notes,
        logged_at: loggedAt || new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    if (inventoryReference !== null && inventoryRemaining !== null) {
      if (inventoryRemaining <= 0) {
        const { error: deleteError } = await supabase
          .from(USER_INVENTORY_TABLE)
          .delete()
          .eq('id', inventoryReference)
          .eq('user_id', userId);
        if (deleteError) throw deleteError;
      } else {
        const { error: updateError } = await supabase
          .from(USER_INVENTORY_TABLE)
          .update({ quantity: inventoryRemaining })
          .eq('id', inventoryReference)
          .eq('user_id', userId);
        if (updateError) throw updateError;
      }
    }

    // Fire-and-forget waste analysis. Errors here should not block logging.
    analyzeUsageAndSyncWaste(userId, {
      itemName: logItemName,
      category: logCategory,
      quantity: logQuantity,
      unit: logUnit,
    }).catch((wasteError) => {
      console.error('Waste analysis failed after usage log:', wasteError);
    });

    return res.status(201).json({ log: data });
  } catch (error) {
    console.error('addLog error', error);
    return res.status(500).json({ message: 'Failed to save log', error: error.message });
  }
};

export const suggestUsagePlan = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ message: 'OPENAI_API_KEY not configured on server' });
  }

  const { dishes, servings, audience } = req.body;
  if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
    return res.status(400).json({ message: 'Provide at least one dish name' });
  }

  try {
    const [{ data: profile, error: profileError }, { data: inventory, error: inventoryError }] =
      await Promise.all([
        supabase
          .from(USERS_TABLE)
          .select(
            `full_name, dietary_preferences, budget_amount_bdt, budget_period,
             household_children, household_teens, household_adults, household_elderly`,
          )
          .eq('id', userId)
          .single(),
        supabase
          .from(USER_INVENTORY_TABLE)
          .select('id, custom_name, quantity, unit, category, expires_at, food_item:food_item_id(name)')
          .eq('user_id', userId),
      ]);

    if (profileError) throw profileError;
    if (inventoryError) throw inventoryError;

    const client = createOpenAIClient();
    if (!client) {
      return res.status(500).json({ message: 'OpenAI client not configured' });
    }

    const prompt = `
You are a food sustainability assistant. The user wants to cook the following dishes: ${dishes.join(
      ', ',
    )}. They might mention the audience such as "children" or "adults": ${
      audience || 'not provided'
    }. They plan to feed approximately ${servings || 'unspecified'} people.

Profile context:
- Dietary preferences: ${profile?.dietary_preferences || 'not specified'}
- Budget: ${
      profile?.budget_amount_bdt
        ? `${profile.budget_amount_bdt} BDT per ${profile?.budget_period || 'month'}`
        : 'not specified'
    }
- Household: ${profile?.household_children || 0} children, ${profile?.household_teens || 0} teens, ${
      profile?.household_adults || 0
    } adults, ${profile?.household_elderly || 0} elderly.

Inventory items:
${inventory
  .map((item) => {
    const label = item.custom_name || item.food_item?.name || 'Unnamed item';
    return `- ${label} (id: ${item.id}) — ${item.quantity ?? 0} ${item.unit ?? ''} · ${
      item.category
    } · expires ${item.expires_at || 'unknown'}`;
  })
  .join('\n')}

Return **ONLY** valid JSON (no prose, no markdown). The JSON must match exactly:
{
  "suggestions": [
    { "inventory_item_id": "uuid-1", "amount_to_use": 0.5 },
    { "inventory_item_id": "uuid-2", "amount_to_use": 1 }
  ],
  "missing_items": [
    { "name": "Spinach", "suggested_quantity": "2 bunches", "note": "Needed for spinach curry" }
  ]
}

Rules:
- Never exceed an item's available quantity.
- Omitting a field or adding extra ones is not allowed.
- If nothing is missing, return "missing_items": [].
`;

    const completion = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You are a culinary assistant helping families minimize waste. Always respond with strict JSON as requested.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const contentBlock = completion.output?.flatMap((chunk) => chunk.content || [])?.find(
      (entry) => entry.type === 'output_text',
    );

    const textPayload = contentBlock?.text?.trim();
    if (!textPayload) {
      throw new Error('OpenAI response missing JSON text');
    }

    const parsed = JSON.parse(textPayload);
    parsed.suggestions ??= [];
    parsed.missing_items ??= [];

    console.log('AI usage plan response:', JSON.stringify(parsed, null, 2));

    return res.json(parsed);
  } catch (error) {
    console.error('suggestUsagePlan error', error);
    return res.status(500).json({ message: 'Failed to fetch AI plan', error: error.message });
  }
};

