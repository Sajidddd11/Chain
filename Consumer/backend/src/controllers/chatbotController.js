import { supabase } from '../config/supabaseClient.js';
import { createOpenAIClient } from '../config/openaiClient.js';

const USERS_TABLE = 'users';
const USER_INVENTORY_TABLE = 'user_inventory';
const CONSUMPTION_LOGS_TABLE = 'consumption_logs';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

const getUserId = (req) => {
  return req.user?.id || null;
};

// Build comprehensive context for the chatbot
const buildUserContext = async (userId) => {
  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Get inventory items
    const { data: inventory, error: inventoryError } = await supabase
      .from(USER_INVENTORY_TABLE)
      .select('custom_name, quantity, unit, category, expires_at, price, purchased_at, food_item:food_item_id(name)')
      .eq('user_id', userId)
      .order('expires_at', { ascending: true });

    if (inventoryError) throw inventoryError;

    // Get recent consumption logs (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: logs, error: logsError } = await supabase
      .from(CONSUMPTION_LOGS_TABLE)
      .select('item_name, category, quantity, unit, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', thirtyDaysAgo.toISOString())
      .order('logged_at', { ascending: false })
      .limit(50);

    if (logsError) throw logsError;

    // Calculate inventory summary
    const inventorySummary = {
      totalItems: inventory?.length || 0,
      expiringSoon: inventory?.filter(item => {
        if (!item.expires_at) return false;
        const expiryDate = new Date(item.expires_at);
        const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
      }).length || 0,
      categories: {},
      totalValue: inventory?.reduce((sum, item) => sum + (Number(item.price) || 0), 0) || 0,
    };

    inventory?.forEach(item => {
      const category = item.category || 'Other';
      inventorySummary.categories[category] = (inventorySummary.categories[category] || 0) + 1;
    });

    // Calculate consumption patterns
    const consumptionPatterns = {
      totalLogs: logs?.length || 0,
      categories: {},
      recentItems: logs?.slice(0, 10).map(log => ({
        name: log.item_name,
        category: log.category,
        date: log.logged_at,
      })) || [],
    };

    logs?.forEach(log => {
      const category = log.category || 'Other';
      consumptionPatterns.categories[category] = (consumptionPatterns.categories[category] || 0) + 1;
    });

    return {
      profile: {
        name: profile?.full_name || 'User',
        householdSize: profile?.household_size || 0,
        children: profile?.household_children || 0,
        teens: profile?.household_teens || 0,
        adults: profile?.household_adults || 0,
        elderly: profile?.household_elderly || 0,
        dietaryPreferences: profile?.dietary_preferences || 'Not specified',
        budget: profile?.budget_amount_bdt ? {
          amount: Number(profile.budget_amount_bdt),
          period: profile.budget_period || 'monthly',
        } : null,
        location: profile?.location || 'Not specified',
      },
      inventory: {
        summary: inventorySummary,
        items: inventory?.slice(0, 20).map(item => ({
          name: item.custom_name || item.food_item?.name || 'Unknown',
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          expiresAt: item.expires_at,
          daysUntilExpiry: item.expires_at ? Math.ceil((new Date(item.expires_at) - new Date()) / (1000 * 60 * 60 * 24)) : null,
          price: item.price,
        })) || [],
      },
      consumption: consumptionPatterns,
    };
  } catch (error) {
    console.error('Error building user context:', error);
    return null;
  }
};

// No conversation storage needed - handled in localStorage on frontend

// Send message to chatbot
export const sendMessage = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  const { message, history } = req.body;

  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // History is passed from frontend localStorage (last 20 messages for context)
    const conversationHistory = Array.isArray(history) ? history.slice(-20) : [];

    // Get user context
    const userContext = await buildUserContext(userId);

    // Build prompt for OpenAI
    const systemPrompt = `You are NourishBot, an AI assistant helping users with food sustainability, waste reduction, nutrition, and budget meal planning. You are friendly, knowledgeable, and practical.

Your capabilities include:
- Food waste reduction advice
- Nutrition balancing and meal planning
- Budget-friendly meal suggestions
- Creative ideas for transforming leftovers
- Guidance on local food sharing
- Explanations of environmental impacts
- Inventory management tips
- Expiration date management
- **Image Analysis**: You can analyze images of food, leftovers, or receipts to provide specific advice, recipes, or inventory updates.

Always provide actionable, practical advice. Use **Markdown** formatting for your responses (bold, lists, headers) to make them easy to read. Be concise but helpful.`;

    const contextPrompt = userContext ? `
User Profile:
- Name: ${userContext.profile.name}
- Household: ${userContext.profile.adults} adults, ${userContext.profile.children} children, ${userContext.profile.teens} teens, ${userContext.profile.elderly} elderly
- Dietary Preferences: ${userContext.profile.dietaryPreferences}
- Budget: ${userContext.profile.budget ? `${userContext.profile.budget.amount} BDT per ${userContext.profile.budget.period}` : 'Not set'}
- Location: ${userContext.profile.location}

Current Inventory (${userContext.inventory.summary.totalItems} items):
${userContext.inventory.items.length > 0 ? userContext.inventory.items.map(item =>
      `- ${item.name} (${item.quantity || '?'} ${item.unit || ''}) - ${item.category} - ${item.daysUntilExpiry !== null ? `expires in ${item.daysUntilExpiry} days` : 'no expiry date'}`
    ).join('\n') : 'No items in inventory'}

Expiring Soon (${userContext.inventory.summary.expiringSoon} items):
${userContext.inventory.items.filter(item => item.daysUntilExpiry !== null && item.daysUntilExpiry <= 3).map(item =>
      `- ${item.name} expires in ${item.daysUntilExpiry} days`
    ).join('\n') || 'None'}

Recent Consumption (last 30 days):
${userContext.consumption.recentItems.length > 0 ? userContext.consumption.recentItems.map(item =>
      `- ${item.name} (${item.category})`
    ).join('\n') : 'No recent consumption logged'}

Consumption Patterns:
${Object.entries(userContext.consumption.categories).map(([cat, count]) => `- ${cat}: ${count} times`).join('\n') || 'No patterns yet'}
` : '';

    // Build conversation history for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt + contextPrompt },
      ...conversationHistory.map(msg => {
        if (msg.image) {
          return {
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: [
              { type: 'text', text: msg.content },
              { type: 'image_url', image_url: { url: msg.image } }
            ]
          };
        }
        return {
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        };
      }),
    ];

    // Add current message
    if (req.body.image) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message.trim() },
          { type: 'image_url', image_url: { url: req.body.image } }
        ]
      });
    } else {
      messages.push({ role: 'user', content: message.trim() });
    }

    // Call OpenAI
    const openai = createOpenAIClient();
    if (!openai) {
      return res.status(500).json({ message: 'OpenAI API not configured' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', // Enable GPT-4 for all clients
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';

    // Store conversation in database (Fire and forget / Best effort)
    let conversationId = null;
    try {
      // 1. Get or create conversation
      const { data: existingConv } = await supabase
        .from('chatbot_conversations')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
        // Update timestamp
        await supabase
          .from('chatbot_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      } else {
        const { data: newConv, error: createError } = await supabase
          .from('chatbot_conversations')
          .insert({ user_id: userId, title: 'NourishBot Chat' })
          .select()
          .single();

        if (!createError && newConv) {
          conversationId = newConv.id;
        }
      }

      if (conversationId) {
        // 2. Store user message
        await supabase.from('chatbot_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: message.trim(),
        });

        // 3. Store assistant message
        await supabase.from('chatbot_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantResponse,
        });
      }
    } catch (dbError) {
      console.warn('Failed to save chat history to database (tables might be missing):', dbError.message);
      // Continue without saving to DB
    }

    return res.json({
      response: assistantResponse,
      conversationId: conversationId
    });
  } catch (error) {
    console.error('sendMessage error', error);
    return res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
};

// Get chat history
export const getHistory = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User ID not found' });
  }

  try {
    // Get most recent conversation
    const { data: conversation } = await supabase
      .from('chatbot_conversations')
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      return res.json({ messages: [] });
    }

    // Get messages
    const { data: messages, error } = await supabase
      .from('chatbot_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return res.json({ messages });
  } catch (error) {
    console.error('getHistory error', error);
    return res.status(500).json({ message: 'Failed to get history', error: error.message });
  }
};

export default {
  sendMessage,
  getHistory,
};

