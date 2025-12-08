import { supabase } from '../config/supabaseClient.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

export const suggestRecipes = async (req, res) => {
  console.log('suggestRecipes called');
  
  if (!ensureSupabase(res)) return;

  if (!openai) {
    console.error('OpenAI not initialized');
    return res.status(500).json({ message: 'OpenAI API key not configured' });
  }

  const { query, cuisine } = req.body;
  console.log('Query received:', query || '(empty)', 'Cuisine:', cuisine || '(none)');

  try {
    let prompt;
    let useInventory = !query || !query.trim();
    
    const cuisineInstruction = cuisine ? `The user prefers ${cuisine} cuisine. Please adapt the recipes to this style if possible.` : '';
    
    // If user provides a query, use ONLY that query (ignore pantry)
    if (query && query.trim()) {
      console.log('Generating recipe for custom query:', query);
      prompt = `You are a professional chef. The user is asking for a recipe with these specific ingredients or dish:

User Request: "${query}"
${cuisineInstruction}

Generate 3-5 delicious recipes based on what the user asked for. Be creative and provide authentic recipes.

For each recipe:
- If it's a specific dish name (like "pasta carbonara"), create that exact recipe
- If it's ingredients (like "chicken, tomatoes, rice"), create recipes using those ingredients
- Include common pantry staples (salt, pepper, oil, etc.) without listing them

Return a JSON array of recipe objects. Each recipe should have:
- title: Recipe name
- description: Brief description (2-3 sentences) explaining what makes this dish special
- ingredients: Array of objects with name, quantity, unit, priority ("fresh" for all), expiryDays (365 for all)
- instructions: Array of detailed step-by-step cooking instructions (at least 5 steps)
- prepTime: Preparation time in minutes (realistic)
- cookTime: Cooking time in minutes (realistic)
- servings: Number of servings (2-6)
- difficulty: "Easy", "Medium", or "Hard"

Example format:
[
  {
    "title": "Classic Chicken Curry",
    "description": "A rich and flavorful curry with tender chicken pieces...",
    "ingredients": [
      {"name": "chicken", "quantity": 500, "unit": "g", "priority": "fresh", "expiryDays": 365},
      {"name": "onions", "quantity": 2, "unit": "medium", "priority": "fresh", "expiryDays": 365}
    ],
    "instructions": [
      "Heat oil in a large pan over medium heat",
      "Add chopped onions and sauté until golden brown",
      ...
    ],
    "prepTime": 15,
    "cookTime": 30,
    "servings": 4,
    "difficulty": "Medium"
  }
]

Return ONLY valid JSON, no markdown, no explanations.`;
    } else {
      // If query is empty, use pantry items
      if (!req.user?.id) {
        console.error('No user ID found in request');
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const { data: inventory, error: inventoryError } = await supabase
        .from('user_inventory')
        .select(`
          custom_name,
          quantity,
          unit,
          category,
          expires_at,
          food_item:food_item_id (
            name,
            category
          )
        `)
        .eq('user_id', req.user.id)
        .not('expires_at', 'is', null)
        .order('expires_at', { ascending: true });

      if (inventoryError) {
        console.error('Inventory fetch error:', inventoryError);
        throw inventoryError;
      }

      if (!inventory || inventory.length === 0) {
        return res.status(200).json({
          message: 'No inventory items found. Please add items to your pantry first.',
          suggestions: []
        });
      }

      // Process inventory data
      const inventoryItems = inventory.map(item => {
        const name = item.custom_name || item.food_item?.name || 'Unknown';
        const expiresAt = new Date(item.expires_at);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

        let priority = 'fresh';
        if (daysUntilExpiry <= 1) priority = 'expiring-soon';
        else if (daysUntilExpiry <= 7) priority = 'expiring-week';

        return {
          name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          expiryDays: daysUntilExpiry,
          priority
        };
      });

      // Sort by priority (expiring soon first)
      const priorityOrder = { 'expiring-soon': 0, 'expiring-week': 1, 'fresh': 2 };
      inventoryItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      // Create inventory summary for AI
      const inventorySummary = inventoryItems
        .slice(0, 20) // Limit to top 20 items
        .map(item => `${item.name} (${item.quantity} ${item.unit}, expires in ${item.expiryDays} days, priority: ${item.priority})`)
        .join('\n');

      prompt = `You are a professional chef and food waste reduction expert. Based on the following pantry inventory, suggest 3-5 delicious recipes that use items that are expiring soon first.
${cuisineInstruction}

Inventory (sorted by expiry priority):
${inventorySummary}

IMPORTANT: 
- Use ONLY ingredients from the inventory above
- Each recipe MUST use at least 3-5 items from the inventory
- Prioritize using ingredients that are expiring soon (expiring-soon and expiring-week)
- You can assume basic pantry staples (salt, pepper, oil, water) are available
- Include the exact expiry information for each ingredient from the inventory

Return a JSON array of recipe objects. Each recipe should:
- Prioritize using ingredients that are expiring soon
- Use multiple inventory items when possible
- Be realistic and delicious
- Include detailed cooking instructions

Each recipe should have:
- title: Creative and appealing recipe name
- description: Brief description (2-3 sentences) highlighting which inventory ingredients are used
- ingredients: Array of objects with name, quantity, unit, priority, expiryDays (use EXACT items from inventory with their expiry info)
- instructions: Array of detailed step-by-step instructions (at least 5 steps)
- prepTime: Preparation time in minutes
- cookTime: Cooking time in minutes  
- servings: Number of servings (2-6)
- difficulty: "Easy", "Medium", or "Hard"

Example ingredient from inventory:
{
  "name": "chicken breast",
  "quantity": 500,
  "unit": "g",
  "priority": "expiring-soon",
  "expiryDays": 2
}

Return ONLY valid JSON, no markdown, no explanations.`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional chef. Return only valid JSON arrays of recipe objects.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) {
      return res.status(500).json({ message: 'Failed to generate recipes' });
    }

    let suggestions;
    try {
      // Clean up markdown code blocks if present
      const jsonString = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      suggestions = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError.message);
      return res.status(500).json({ 
        message: 'Failed to parse recipe suggestions',
        error: 'Invalid JSON response from AI'
      });
    }

    if (!Array.isArray(suggestions)) {
      console.error('AI response is not an array');
      return res.status(500).json({ message: 'Invalid recipe suggestions format' });
    }

    return res.status(200).json({
      message: 'Recipe suggestions generated successfully',
      suggestions: suggestions.slice(0, 5), // Limit to 5 recipes
      source: useInventory ? 'inventory' : 'custom',
    });
  } catch (error) {
    console.error('=== Recipe generation error ===');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    if (error.response) {
      console.error('OpenAI API error:', error.response.data);
    }
    console.error('Stack:', error.stack);

    try {
      const logPath = path.join(process.cwd(), 'error.log');
      const timestamp = new Date().toISOString();
      const logMessage = `\n${timestamp} - ERROR in suggestRecipes:\nMessage: ${error.message}\nName: ${error.name}\nStack: ${error.stack}\nOpenAI Data: ${JSON.stringify(error.response?.data || {})}\n`;
      fs.appendFileSync(logPath, logMessage);
    } catch (logError) {
      console.error('Failed to write to error log:', logError);
    }
    
    return res.status(500).json({ 
      message: 'Failed to generate recipe suggestions', 
      error: error.message
    });
  }
};