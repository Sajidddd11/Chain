import { supabase } from '../config/supabaseClient.js';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

/**
 * Calculate SDG Impact Score based on user's waste reduction and nutrition data
 */
async function calculateSDGScore(req, res) {
    const userId = req.user.id;

    try {
        // Fetch user's waste data (with graceful handling if table missing)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        let wasteData;
        try {
            const { data, error } = await supabase
                .from('user_waste_materials')
                .select('quantity_value')
                .eq('user_id', userId)
                .gte('created_at', thirtyDaysAgo.toISOString());
            if (error) {
                // If the table does not exist, Supabase returns code PGRST205
                if (error.code === 'PGRST205') {
                    return res.status(400).json({
                        message: 'Waste data table is missing. Please run the database migration to create `user_waste_materials`.',
                    });
                }
                throw error;
            }
            wasteData = data;
        } catch (err) {
            console.error('Error fetching waste data:', err);
            return res.status(500).json({ message: 'Failed to fetch waste data', error: err.message });
        }

        const wasteStats = {
            total_waste_entries: wasteData.length,
            total_waste_quantity: wasteData.reduce((sum, item) => sum + (parseFloat(item.quantity_value) || 0), 0),
            avg_waste_quantity: wasteData.length > 0 ? wasteData.reduce((sum, item) => sum + (parseFloat(item.quantity_value) || 0), 0) / wasteData.length : 0
        };

        // Fetch user's consumption patterns
        const { data: consumptionData, error: consumptionError } = await supabase
            .from('consumption_logs')
            .select('quantity, category')
            .eq('user_id', userId)
            .gte('logged_at', thirtyDaysAgo.toISOString());

        if (consumptionError) throw consumptionError;

        const consumptionStats = {
            total_logs: consumptionData.length,
            total_consumption: consumptionData.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0),
            category_diversity: new Set(consumptionData.map(item => item.category)).size
        };

        // Fetch inventory management efficiency
        const { data: inventoryData, error: inventoryError } = await supabase
            .from('user_inventory')
            .select('expires_at')
            .eq('user_id', userId);

        if (inventoryError) throw inventoryError;

        const now = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(now.getDate() + 3);

        const inventoryStats = {
            total_items: inventoryData.length,
            expired_items: inventoryData.filter(item => item.expires_at && new Date(item.expires_at) < now).length,
            expiring_soon: inventoryData.filter(item =>
                item.expires_at &&
                new Date(item.expires_at) >= now &&
                new Date(item.expires_at) <= threeDaysFromNow
            ).length
        };

        // Fetch category breakdown for nutrition analysis
        const categoryBreakdown = consumptionData.reduce((acc, item) => {
            const category = item.category || 'Unknown';
            if (!acc[category]) {
                acc[category] = { count: 0, total_quantity: 0 };
            }
            acc[category].count += 1;
            acc[category].total_quantity += parseFloat(item.quantity) || 0;
            return acc;
        }, {});

        const categoryBreakdownArray = Object.entries(categoryBreakdown)
            .map(([category, stats]) => ({
                category,
                count: stats.count,
                total_quantity: stats.total_quantity
            }))
            .sort((a, b) => b.total_quantity - a.total_quantity);

        // Calculate base scores
        const wasteReductionScore = calculateWasteReductionScore(wasteStats, inventoryStats);
        const nutritionScore = calculateNutritionScore(categoryBreakdownArray, consumptionStats);
        const inventoryEfficiencyScore = calculateInventoryEfficiency(inventoryStats);

        // Overall SDG score (0-100)
        const overallScore = Math.round(
            wasteReductionScore * 0.4 +
            nutritionScore * 0.35 +
            inventoryEfficiencyScore * 0.25
        );

        // Generate AI-powered insights and recommendations
        const aiInsights = await generateAIInsights({
            wasteData: wasteStats,
            consumptionData: consumptionStats,
            inventoryData: inventoryStats,
            categoryBreakdown: categoryBreakdownArray,
            scores: {
                waste: wasteReductionScore,
                nutrition: nutritionScore,
                inventory: inventoryEfficiencyScore,
                overall: overallScore
            }
        });

        // Calculate weekly improvement
        const { data: previousScores, error: historyError } = await supabase
            .from('sdg_scores')
            .select('score, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(2);

        if (historyError) throw historyError;

        const weeklyImprovement = previousScores && previousScores.length >= 2
            ? overallScore - previousScores[1].score
            : 0;

        // Store the score
        const { error: insertError } = await supabase
            .from('sdg_scores')
            .insert({
                user_id: userId,
                score: overallScore,
                waste_score: wasteReductionScore,
                nutrition_score: nutritionScore,
                inventory_score: inventoryEfficiencyScore,
                insights: JSON.stringify(aiInsights),
                created_at: new Date().toISOString()
            });

        if (insertError) throw insertError;

        res.json({
            score: overallScore,
            breakdown: {
                wasteReduction: Math.round(wasteReductionScore),
                nutrition: Math.round(nutritionScore),
                inventoryEfficiency: Math.round(inventoryEfficiencyScore)
            },
            weeklyImprovement,
            insights: aiInsights,
            categoryBreakdown: categoryBreakdownArray.map(cat => ({
                category: cat.category,
                count: cat.count,
                quantity: cat.total_quantity
            }))
        });

    } catch (error) {
        console.error('Error calculating SDG score:', error);
        res.status(500).json({ message: 'Failed to calculate SDG score', error: error.message });
    }
}

/**
 * Get SDG score history
 */
async function getSDGHistory(req, res) {
    const userId = req.user.id;
    const { period = 'month' } = req.query;

    try {
        let daysBack = 30;
        if (period === 'week') daysBack = 7;
        if (period === 'year') daysBack = 365;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const { data: historyData, error } = await supabase
            .from('sdg_scores')
            .select('score, waste_score, nutrition_score, inventory_score, insights, created_at')
            .eq('user_id', userId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            history: historyData.map(row => ({
                score: row.score,
                breakdown: {
                    wasteReduction: row.waste_score,
                    nutrition: row.nutrition_score,
                    inventoryEfficiency: row.inventory_score
                },
                insights: row.insights,
                date: row.created_at
            }))
        });

    } catch (error) {
        console.error('Error fetching SDG history:', error);
        res.status(500).json({ message: 'Failed to fetch SDG history', error: error.message });
    }
}

// Helper functions
function calculateWasteReductionScore(wasteData, inventoryData) {
    const totalWaste = parseFloat(wasteData.total_waste_quantity) || 0;
    const expiredItems = parseInt(inventoryData.expired_items) || 0;
    const totalItems = parseInt(inventoryData.total_items) || 1;

    // Lower waste = higher score
    const wasteRatio = totalWaste / 100; // Normalize
    const expiredRatio = expiredItems / totalItems;

    // Score from 0-100, where less waste = higher score
    const score = Math.max(0, 100 - (wasteRatio * 30) - (expiredRatio * 70));
    return Math.min(100, score);
}

function calculateNutritionScore(categoryBreakdown, consumptionData) {
    if (!categoryBreakdown || categoryBreakdown.length === 0) {
        return 50; // Neutral score if no data
    }

    const categoryDiversity = parseInt(consumptionData.category_diversity) || 1;

    // Ideal categories for balanced nutrition
    const idealCategories = ['vegetables', 'fruits', 'grains', 'protein', 'dairy'];
    const userCategories = categoryBreakdown.map(c => c.category.toLowerCase());

    const matchedCategories = idealCategories.filter(cat =>
        userCategories.some(userCat => userCat.includes(cat))
    ).length;

    // Diversity score (0-50 points)
    const diversityScore = (matchedCategories / idealCategories.length) * 50;

    // Balance score (0-50 points) - check if consumption is balanced
    const quantities = categoryBreakdown.map(c => parseFloat(c.total_quantity));
    const avgQuantity = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    const variance = quantities.reduce((sum, q) => sum + Math.pow(q - avgQuantity, 2), 0) / quantities.length;
    const balanceScore = Math.max(0, 50 - (variance / avgQuantity) * 10);

    return Math.min(100, diversityScore + balanceScore);
}

function calculateInventoryEfficiency(inventoryData) {
    const totalItems = parseInt(inventoryData.total_items) || 1;
    const expiredItems = parseInt(inventoryData.expired_items) || 0;
    const expiringSoon = parseInt(inventoryData.expiring_soon) || 0;

    // Efficiency based on how well user manages expiry
    const expiredRatio = expiredItems / totalItems;
    const expiringSoonRatio = expiringSoon / totalItems;

    // Lower expired items = higher score
    const score = 100 - (expiredRatio * 60) - (expiringSoonRatio * 20);
    return Math.max(0, Math.min(100, score));
}

async function generateAIInsights(data) {
    try {
        const prompt = `You are an SDG (Sustainable Development Goals) advisor analyzing a user's food consumption and waste patterns.\n\nUser Data:\n- Overall SDG Score: ${data.scores.overall}/100\n- Waste Reduction Score: ${data.scores.waste}/100\n- Nutrition Score: ${data.scores.nutrition}/100\n- Inventory Efficiency Score: ${data.scores.inventory}/100\n\nWaste Data:\n- Total waste entries (30 days): ${data.wasteData.total_waste_entries}\n- Total waste quantity: ${data.wasteData.total_waste_quantity}\n\nConsumption Data:\n- Total consumption logs: ${data.consumptionData.total_logs}\n- Category diversity: ${data.consumptionData.category_diversity}\n\nInventory Data:\n- Total items: ${data.inventoryData.total_items}\n- Expired items: ${data.inventoryData.expired_items}\n- Expiring soon: ${data.inventoryData.expiring_soon}\n\nCategory Breakdown:\n${data.categoryBreakdown.map(c => `- ${c.category}: ${c.total_quantity} units`).join('\\n')}\n\nProvide a JSON response with:\n1. \"weeklyInsight\": A brief, encouraging insight about their progress (max 100 chars)\n2. \"topStrength\": What they're doing well (max 80 chars)\n3. \"topWeakness\": Main area for improvement (max 80 chars)\n4. \"actionableSteps\": Array of 3 specific, actionable next steps to improve their score (each max 120 chars)\n5. \"scoreImpact\": For each actionable step, estimate potential score improvement (e.g., \"+5 points\", \"+10 points\")\n\nFocus on SDG 2 (Zero Hunger), SDG 3 (Good Health), and SDG 12 (Responsible Consumption).\nBe specific, encouraging, and practical. Use real numbers from the data.\n\nReturn ONLY valid JSON, no markdown formatting.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // lightweight model suitable for JSON generation
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
        });

        const responseText = completion.choices[0].message.content?.trim() || '';
        // Strip any markdown if present
        const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const insights = JSON.parse(jsonText);

        return {
            weeklyInsight: insights.weeklyInsight || "Keep tracking your consumption to improve sustainability!",
            topStrength: insights.topStrength || "Good inventory management",
            topWeakness: insights.topWeakness || "Focus on reducing waste",
            actionableSteps: insights.actionableSteps || [
                "Plan meals to use expiring items first",
                "Increase vegetable consumption for better nutrition",
                "Track waste patterns to identify problem areas"
            ],
            scoreImpact: insights.scoreImpact || ["+8 points", "+10 points", "+7 points"]
        };
    } catch (error) {
        console.error('Error generating AI insights:', error);
        // Return fallback insights
        return {
            weeklyInsight: "Continue tracking your food consumption for better sustainability insights",
            topStrength: "Active inventory management",
            topWeakness: "Opportunity to reduce food waste",
            actionableSteps: [
                "Use items nearing expiry first to reduce waste",
                "Diversify your diet with more vegetables and fruits",
                "Review and optimize your shopping patterns"
            ],
            scoreImpact: ["+8 points", "+10 points", "+7 points"]
        };
    }
}

export { calculateSDGScore, getSDGHistory };
