import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { InventoryItem } from '../types';
import {
  Sparkles,
  DollarSign,
  Calendar,
  ShoppingCart,
  Activity,
  ChevronRight,
  Check,
  Utensils,
  X,
  Star
} from 'lucide-react';

interface Ingredient {
  name: string;
  inInventory: boolean;
}

interface MealPlan {
  day: string;
  meals: {
    type: 'Breakfast' | 'Lunch' | 'Dinner';
    name: string;
    cost: number;
    calories: number;
    protein: number;
    ingredients: Ingredient[];
  }[];
  dailyCost: number;
}

interface ShoppingItem {
  name: string;
  quantity: string;
  estimatedCost: number;
  category: string;
}

const CUISINE_OPTIONS = [
  'Bengali',
  'Indian',
  'Asian',
  'Thai',
  'Western',
  'Mediterranean',
  'Mixed'
];

const MEAL_QUALITY_OPTIONS = [
  { value: 'budget', label: 'Budget Friendly', description: 'Cheapest ingredients, simple recipes' },
  { value: 'basic', label: 'Basic Quality', description: 'Standard ingredients, everyday meals' },
  { value: 'standard', label: 'Standard Quality', description: 'Fresh ingredients, balanced meals' },
  { value: 'premium', label: 'Premium Quality', description: 'High-quality ingredients, gourmet touches' },
  { value: 'luxury', label: 'Luxury Quality', description: 'Finest ingredients, chef-inspired meals' }
];

export function MealOptimizationEngine() {
  const { token } = useAuth();
  const [budget, setBudget] = useState<string>('5000');
  const [cuisine, setCuisine] = useState<string>('Bengali');
  const [mealQuality, setMealQuality] = useState<string>('standard');
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<MealPlan[] | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [activeDay, setActiveDay] = useState<string>('Monday');
  const [showFullList, setShowFullList] = useState(false);
  const [hasUserSetBudget, setHasUserSetBudget] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Ref to track if initial load has happened to prevent double generation
  const initialLoadDone = useRef(false);
  // Ref for debounce
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate weekly budget from user's stored budget
  const calculateWeeklyBudget = (budgetAmount: number, budgetPeriod: string): number => {
    if (!budgetAmount || budgetAmount <= 0) return 5000; // Default fallback

    switch (budgetPeriod.toLowerCase()) {
      case 'daily':
        return Math.round(budgetAmount * 7); // 7 days in a week
      case 'weekly':
        return Math.round(budgetAmount); // Already weekly
      case 'monthly':
        return Math.round(budgetAmount / 4.33); // Average weeks per month
      case 'yearly':
        return Math.round(budgetAmount / 52); // 52 weeks in a year
      default:
        return Math.round(budgetAmount / 4.33); // Default to monthly calculation
    }
  };

  // Dummy nutrient rules
  const nutrientTargets = {
    calories: 2000,
    protein: 150, // g
    carbs: 250, // g
    fats: 70 // g
  };

  const handleGenerate = async () => {
    setGenerating(true);

    // Save settings immediately
    localStorage.setItem('mealPlan_settings', JSON.stringify({
      budget,
      cuisine,
      mealQuality,
      hasUserSetBudget
    }));

    // Simulate AI delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock data generation based on "inventory", "budget", and "cuisine"
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'] as const;



    // Helper to check if an ingredient is in inventory (fuzzy match)
    const checkInventory = (ingredientName: string) => {
      return inventory.some(item => {
        const itemName = item.custom_name || item.food_item?.name || '';
        if (!itemName) return false;
        return itemName.toLowerCase().includes(ingredientName.toLowerCase()) ||
          ingredientName.toLowerCase().includes(itemName.toLowerCase());
      });
    };

    const generatedPlan: MealPlan[] = days.map(day => {
      const meals = mealTypes.map(type => {
        // Generate some ingredients based on the meal type and cuisine
        // This is still mock logic, but now it checks against the actual inventory
        const baseIngredients = getMockIngredients(type, cuisine);

        // Map ingredients to status
        const ingredientsWithStatus = baseIngredients.map(ing => ({
          name: ing,
          inInventory: checkInventory(ing)
        }));

        // Generate realistic meal costs based on quality level
        let baseCostRange;
        if (type === 'Breakfast') {
          // Breakfast: affordable meal
          baseCostRange = mealQuality === 'budget' ? [40, 80] :
            mealQuality === 'basic' ? [60, 120] :
              mealQuality === 'standard' ? [80, 160] :
                mealQuality === 'premium' ? [120, 220] :
                  [160, 300]; // luxury
        } else if (type === 'Lunch') {
          // Lunch: main meal of the day
          baseCostRange = mealQuality === 'budget' ? [80, 140] :
            mealQuality === 'basic' ? [120, 200] :
              mealQuality === 'standard' ? [160, 280] :
                mealQuality === 'premium' ? [240, 400] :
                  [320, 550]; // luxury
        } else {
          // Dinner: substantial meal
          baseCostRange = mealQuality === 'budget' ? [100, 180] :
            mealQuality === 'basic' ? [150, 260] :
              mealQuality === 'standard' ? [200, 350] :
                mealQuality === 'premium' ? [300, 500] :
                  [400, 700]; // luxury
        }

        const [minCost, maxCost] = baseCostRange;
        let mealCost = Math.floor(Math.random() * (maxCost - minCost)) + minCost;

        // Ensure minimum cost and cap at reasonable maximum
        mealCost = Math.max(minCost, Math.min(mealCost, maxCost));

        return {
          type,
          name: generateMealName(type, cuisine),
          cost: mealCost,
          calories: Math.floor(Math.random() * 400) + 300,
          protein: Math.floor(Math.random() * 30) + 10,
          ingredients: ingredientsWithStatus
        };
      });

      return {
        day,
        meals,
        dailyCost: meals.reduce((acc, meal) => acc + meal.cost, 0)
      };
    });

    const mockShoppingList: ShoppingItem[] = [
      { name: 'Chicken Breast', quantity: '1 kg', estimatedCost: 450, category: 'Protein' },
      { name: 'Basmati Rice', quantity: '2 kg', estimatedCost: 320, category: 'Grains' },
      { name: 'Mixed Vegetables', quantity: '1 kg', estimatedCost: 150, category: 'Vegetables' },
      { name: 'Cooking Oil', quantity: '1 L', estimatedCost: 180, category: 'Pantry' },
      { name: 'Eggs', quantity: '12 pcs', estimatedCost: 160, category: 'Protein' },
      { name: 'Spices Mix', quantity: '200g', estimatedCost: 120, category: 'Pantry' },
      { name: 'Lentils', quantity: '500g', estimatedCost: 90, category: 'Grains' },
      { name: 'Onions', quantity: '2 kg', estimatedCost: 140, category: 'Vegetables' },
    ];

    setPlan(generatedPlan);
    setShoppingList(mockShoppingList);

    // Cache the results
    localStorage.setItem('mealPlan_data', JSON.stringify({
      plan: generatedPlan,
      shoppingList: mockShoppingList
    }));

    setGenerating(false);
  };

  const getMockIngredients = (type: string, cuisineStyle: string): string[] => {
    // Simple mock ingredient lists based on cuisine
    if (cuisineStyle === 'Bengali') {
      if (type === 'Breakfast') return ['Flour', 'Egg', 'Oil', 'Onion'];
      return ['Rice', 'Lentils', 'Turmeric', 'Chili', 'Fish', 'Potato'];
    }
    if (cuisineStyle === 'Indian') {
      if (type === 'Breakfast') return ['Rice Flour', 'Potato', 'Spices'];
      return ['Basmati Rice', 'Chicken', 'Yogurt', 'Garam Masala', 'Tomato'];
    }
    if (cuisineStyle === 'Asian' || cuisineStyle === 'Thai') {
      if (type === 'Breakfast') return ['Rice', 'Chicken Stock', 'Ginger'];
      return ['Noodles', 'Soy Sauce', 'Chicken', 'Vegetables', 'Garlic'];
    }
    // Default/Western
    if (type === 'Breakfast') return ['Oats', 'Milk', 'Banana', 'Honey'];
    return ['Pasta', 'Tomato Sauce', 'Cheese', 'Ground Beef', 'Herbs'];
  };

  const generateMealName = (type: string, cuisineStyle: string) => {
    const prefixes = ['Spicy', 'Grilled', 'Steamed', 'Roasted', 'Fresh', 'Traditional'];

    let mains = ['Chicken', 'Fish', 'Vegetable', 'Beef', 'Lentil'];
    let sides = ['Curry', 'Stir-fry', 'Salad', 'Soup', 'Bowl'];
    let breakfast = ['Oatmeal with Fruits', 'Egg & Toast', 'Pancakes', 'Yogurt Parfait'];

    // Adjust names based on cuisine
    if (cuisineStyle === 'Bengali') {
      mains = ['Ilish', 'Rui', 'Chicken', 'Beef', 'Mutton', 'Vegetable'];
      sides = ['Bhuna', 'Jhol', 'Bhorta', 'Bhaji', 'Curry'];
      breakfast = ['Paratha & Bhaji', 'Khichuri', 'Ruti & Egg', 'Panta Bhat'];
    } else if (cuisineStyle === 'Indian') {
      mains = ['Paneer', 'Chicken', 'Lamb', 'Aloo', 'Dal'];
      sides = ['Tikka Masala', 'Makhani', 'Vindaloo', 'Korma', 'Biryani'];
      breakfast = ['Dosa', 'Idli', 'Poha', 'Paratha'];
    } else if (cuisineStyle === 'Asian' || cuisineStyle === 'Thai') {
      mains = ['Chicken', 'Shrimp', 'Tofu', 'Beef', 'Pork'];
      sides = ['Pad Thai', 'Green Curry', 'Fried Rice', 'Noodles', 'Stir-fry'];
      breakfast = ['Congee', 'Dim Sum', 'Noodle Soup', 'Bao'];
    }

    if (type === 'Breakfast') {
      return breakfast[Math.floor(Math.random() * breakfast.length)];
    }

    return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${mains[Math.floor(Math.random() * mains.length)]} ${sides[Math.floor(Math.random() * sides.length)]} `;
  };

  // Load inventory and user profile on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;

      try {
        // Fetch inventory
        const inventoryResponse = await api.getInventory(token);
        setInventory(inventoryResponse.items);

        // Fetch user profile to get budget information (only if user hasn't manually set budget)
        if (!hasUserSetBudget) {
          const profileResponse = await api.getProfile(token);
          if (profileResponse.profile?.budget_amount_bdt && profileResponse.profile?.budget_period) {
            const weeklyBudget = calculateWeeklyBudget(
              profileResponse.profile.budget_amount_bdt,
              profileResponse.profile.budget_period
            );
            setBudget(weeklyBudget.toString());
          }
        }
      } catch (err) {
        console.error('Failed to load data for meal plan', err);
      }
    };
    fetchData();
  }, [token]);

  // Load from cache on mount
  useEffect(() => {
    const cachedSettings = localStorage.getItem('mealPlan_settings');
    const cachedData = localStorage.getItem('mealPlan_data');

    if (cachedSettings) {
      const { budget: savedBudget, cuisine: savedCuisine, mealQuality: savedMealQuality, hasUserSetBudget: savedHasUserSetBudget } = JSON.parse(cachedSettings);
      setBudget(savedBudget);
      setCuisine(savedCuisine);
      setMealQuality(savedMealQuality || 'standard');
      setHasUserSetBudget(savedHasUserSetBudget || false);
    }

    if (cachedData) {
      const { plan: savedPlan, shoppingList: savedList } = JSON.parse(cachedData);
      setPlan(savedPlan);
      setShoppingList(savedList);
    } else {
      // If no data but we have settings (or defaults), trigger generation
      handleGenerate();
    }

    initialLoadDone.current = true;
  }, []);

  // Auto-generate when inputs change
  useEffect(() => {
    if (!initialLoadDone.current) return;

    // Clear existing timer
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      handleGenerate();
    }, 1000); // 1 second delay after typing stops

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [budget, cuisine, mealQuality]);

  const totalCost = plan?.reduce((acc, day) => acc + day.dailyCost, 0) || 0;
  const budgetNum = Number(budget) || 0;
  const isOverBudget = totalCost > budgetNum;

  return (
    <div className="meal-optimization-engine animate-fade-in">
      <div className="engine-header">
        <div className="engine-title">
          <div className="icon-wrapper">
            <Sparkles size={24} className="text-primary" />
          </div>
          <div>
            <h3>AI Meal Optimization Engine</h3>
            <p>Weekly plan based on your budget & preferences.</p>
          </div>
        </div>

        <div className="engine-controls">
          <div className="control-group">
            <label>Cuisine Style</label>
            <div className="input-with-icon">
              <Utensils size={16} />
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="modern-select-input"
              >
                {CUISINE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="control-group">
            <label>Meal Quality</label>
            <div className="input-with-icon">
              <Star size={16} />
              <select
                value={mealQuality}
                onChange={(e) => setMealQuality(e.target.value)}
                className="modern-select-input"
                title={MEAL_QUALITY_OPTIONS.find(opt => opt.value === mealQuality)?.description}
              >
                {MEAL_QUALITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} title={opt.description}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="control-group">
            <label>Weekly Budget (BDT) {!hasUserSetBudget && <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: '600' }}>Auto-calculated</span>}</label>
            <div className="input-with-icon">
              <DollarSign size={16} />
              <input
                type="number"
                value={budget}
                onChange={(e) => {
                  setBudget(e.target.value);
                  setHasUserSetBudget(true);
                }}
                placeholder="5000"
              />
            </div>
          </div>

          {/* Hidden generate button for manual trigger if needed, but auto-gen is active */}
          {generating && (
            <div className="generating-indicator">
              <span className="spinner-small"></span>
              <span className="text">Updating...</span>
            </div>
          )}
        </div>
      </div>

      {generating && !plan && (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 1rem',
            border: '4px solid #f1f5f9',
            borderTopColor: '#1f7a4d',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <h4 style={{ margin: '0 0 0.5rem', color: '#334155' }}>Generating Your Meal Plan</h4>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Creating a personalized weekly plan based on your preferences...</p>
        </div>
      )}

      {!generating && !plan && (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <Sparkles size={48} style={{ margin: '0 auto 1rem', color: '#cbd5e1' }} />
          <h4 style={{ margin: '0 0 0.5rem', color: '#334155' }}>Ready to Plan Your Meals</h4>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Adjust your budget and cuisine preferences above to generate a plan</p>
        </div>
      )}

      {plan && (
        <div className="engine-results">
          <div className="results-grid">
            {/* Left Column: Weekly Plan */}
            <div className="plan-section">
              <div className="section-header">
                <h4><Calendar size={18} /> Weekly Schedule</h4>
                <div className="days-tabs">
                  {plan.map(p => (
                    <button
                      key={p.day}
                      className={`day-tab ${activeDay === p.day ? 'active' : ''}`}
                      onClick={() => setActiveDay(p.day)}
                    >
                      {p.day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="daily-meals">
                {plan.find(p => p.day === activeDay)?.meals?.map((meal, idx) => (
                  <div key={idx} className="meal-card">
                    <div className="meal-type">{meal.type}</div>
                    <div className="meal-content">
                      <h5>{meal.name}</h5>
                      <div className="meal-tags">
                        {meal.ingredients?.map((ing, i) => (
                          <span
                            key={i}
                            className={`tag ${ing.inInventory ? 'inventory-tag' : 'cost-tag'}`}
                            title={ing.inInventory ? 'In Inventory' : 'Missing'}
                          >
                            {ing.inInventory ? <Check size={12} /> : <X size={12} />}
                            {ing.name}
                          </span>
                        )) || []}
                        <span className="tag cal-tag">{meal.calories || 0} kcal</span>
                      </div>
                    </div>
                  </div>
                )) || []}
              </div>
            </div>

            {/* Right Column: Stats & Shopping List */}
            <div className="stats-sidebar">
              {/* Budget Card */}
              <div className={`stats-card ${isOverBudget ? 'warning' : 'success'}`}>
                <div className="card-header">
                  <h4>Estimated Cost</h4>
                  <span className={`status-badge ${isOverBudget ? 'over' : 'under'}`}>
                    {isOverBudget ? 'Over Budget' : 'Within Budget'}
                  </span>
                </div>
                <div className="cost-display">
                  <span className="currency">BDT</span>
                  <span className="amount">{totalCost.toLocaleString()}</span>
                  <span className="total">/ {budgetNum.toLocaleString()}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min((totalCost / budgetNum) * 100, 100)}% ` }}
                  ></div>
                </div>
              </div>

              {/* Nutrition Card */}
              <div className="stats-card nutrition-card">
                <div className="card-header">
                  <h4><Activity size={16} /> Daily Nutrition Avg</h4>
                </div>
                <div className="nutrition-grid">
                  <div className="nutrient">
                    <span className="label">Calories</span>
                    <span className="value">2100</span>
                    <span className="target">/ {nutrientTargets.calories}</span>
                  </div>
                  <div className="nutrient">
                    <span className="label">Protein</span>
                    <span className="value">140g</span>
                    <span className="target">/ {nutrientTargets.protein}g</span>
                  </div>
                  <div className="nutrient">
                    <span className="label">Carbs</span>
                    <span className="value">260g</span>
                    <span className="target">/ {nutrientTargets.carbs}g</span>
                  </div>
                </div>
              </div>

              {/* Shopping List Preview */}
              <div className="stats-card shopping-card">
                <div className="card-header">
                  <h4><ShoppingCart size={16} /> Shopping List</h4>
                  <span className="count-badge">{shoppingList.length} items</span>
                </div>
                <div className="shopping-list-preview">
                  {shoppingList.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="shopping-item-row">
                      <div className="item-info">
                        <span className="name">{item.name}</span>
                        <span className="qty">{item.quantity}</span>
                      </div>
                      <span className="price">BDT {item.estimatedCost}</span>
                    </div>
                  ))}
                  {shoppingList.length > 3 && (
                    <div className="more-items">
                      + {shoppingList.length - 3} more items
                    </div>
                  )}
                </div>
                <button
                  className="view-all-btn"
                  onClick={() => setShowFullList(true)}
                >
                  View Full List <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Shopping List Modal */}
      {showFullList && (
        <div className="modal-overlay" onClick={() => setShowFullList(false)}>
          <div className="modal-content shopping-list-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Full Shopping List</h3>
              <button className="modal-close" onClick={() => setShowFullList(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="shopping-list-full">
                {shoppingList.map((item, idx) => (
                  <div key={idx} className="shopping-item-row full-row">
                    <div className="item-info">
                      <span className="name">{item.name}</span>
                      <div className="item-meta">
                        <span className="qty">{item.quantity}</span>
                        <span className="category-pill">{item.category}</span>
                      </div>
                    </div>
                    <span className="price">BDT {item.estimatedCost}</span>
                  </div>
                ))}
                <div className="shopping-total-row">
                  <span>Total Estimated Cost</span>
                  <span className="total-price">
                    BDT {shoppingList.reduce((acc, item) => acc + item.estimatedCost, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="primary-btn-modern" onClick={() => window.print()}>
                Print List
              </button>
              <button className="secondary-btn" onClick={() => setShowFullList(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .meal-optimization-engine {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          overflow: hidden;
          margin-bottom: 2rem;
          border: 1px solid rgba(0,0,0,0.05);
        }

        .engine-header {
          padding: 1.5rem;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .engine-title {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .engine-title h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e293b;
        }

        .engine-title p {
          margin: 0;
          font-size: 0.875rem;
          color: #64748b;
        }

        .icon-wrapper {
          width: 48px;
          height: 48px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }

        .engine-controls {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .control-group label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-with-icon {
          position: relative;
        }

        .input-with-icon svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .input-with-icon input,
        .modern-select-input {
          padding: 0.6rem 1rem 0.6rem 2.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.9rem;
          width: 140px;
          transition: all 0.2s;
          background: white;
          height: 42px;
        }
        
        .modern-select-input {
          appearance: none;
          cursor: pointer;
        }

        .input-with-icon input:focus,
        .modern-select-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          outline: none;
        }

        .generating-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          height: 42px;
          padding: 0 1rem;
          background: #f0fdf4;
          border-radius: 8px;
          border: 1px solid #bbf7d0;
        }
        
        .generating-indicator.text {
          font-size: 0.85rem;
          font-weight: 600;
          color: #166534;
        }

        .engine-results {
          padding: 1.5rem;
          background: #fff;
        }

        .results-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .section-header h4 {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #334155;
        }

        .days-tabs {
          display: flex;
          gap: 0.25rem;
          background: #f1f5f9;
          padding: 0.25rem;
          border-radius: 8px;
          overflow-x: auto;
          max-width: 100%;
        }

        .day-tab {
          border: none;
          background: transparent;
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .day-tab.active {
          background: white;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .daily-meals {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }

        .meal-card {
          display: grid;
          grid-template-columns: 90px 1fr;
          border: 1px solid rgba(31, 122, 77, 0.15);
          border-radius: 10px;
          overflow: hidden;
          transition: all 0.2s;
          background: white;
        }

        .meal-card:hover {
          border-color: var(--green-900);
          box-shadow: 0 4px 12px rgba(31, 122, 77, 0.1);
        }

        .meal-type {
          background: var(--sage-50);
          padding: 0.75rem 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--green-900);
          border-right: 2px solid rgba(31, 122, 77, 0.15);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-align: center;
        }

        .meal-content {
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .meal-content h5 {
          margin: 0;
          font-size: 0.9375rem;
          color: var(--green-900);
          font-weight: 700;
        }

        .meal-tags {
          display: flex;
          gap: 0.375rem;
          flex-wrap: wrap;
        }

        .tag {
          font-size: 0.6875rem;
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-weight: 600;
        }

        .inventory-tag {
          background: rgba(31, 122, 77, 0.1);
          color: var(--green-900);
          border: 1px solid rgba(31, 122, 77, 0.2);
        }

        .cost-tag {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .cal-tag {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
        }

        .stats-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .stats-card {
          background: #f8fafc;
          border-radius: 12px;
          padding: 1rem;
          border: 1px solid #e2e8f0;
        }

        .stats-card.warning {
          background: #fff1f2;
          border-color: #fecdd3;
        }

        .stats-card.success {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .card-header h4 {
          margin: 0;
          font-size: 0.9rem;
          color: #475569;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .status-badge.over {
          background: #fda4af;
          color: #881337;
        }

        .status-badge.under {
          background: #86efac;
          color: #14532d;
        }

        .cost-display {
          margin-bottom: 0.5rem;
        }

        .cost-display.currency {
          font-size: 0.9rem;
          color: #64748b;
          margin-right: 0.25rem;
        }

        .cost-display.amount {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
        }

        .cost-display.total {
          font-size: 0.9rem;
          color: #94a3b8;
          margin-left: 0.5rem;
        }

        .progress-bar {
          height: 6px;
          background: rgba(0,0,0,0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #10b981;
          border-radius: 3px;
        }

        .warning.progress-fill {
          background: #f43f5e;
        }

        .nutrition-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.5rem;
        }

        .nutrient {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: white;
          padding: 0.5rem;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .nutrient.label {
          font-size: 0.7rem;
          color: #64748b;
        }

        .nutrient.value {
          font-size: 0.9rem;
          font-weight: 700;
          color: #1e293b;
        }

        .nutrient.target {
          font-size: 0.65rem;
          color: #94a3b8;
        }

        .shopping-item-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.9rem;
        }

        .shopping-item-row:last-child {
          border-bottom: none;
        }

        .item-info {
          display: flex;
          flex-direction: column;
        }

        .item-info.name {
          font-weight: 500;
          color: #334155;
        }

        .item-info.qty {
          font-size: 0.75rem;
          color: #94a3b8;
        }
        
        .item-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .category-pill {
          font-size: 0.65rem;
          background: #f1f5f9;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          color: #64748b;
        }

        .shopping-item-row.price {
          font-weight: 600;
          color: #475569;
        }

        .more-items {
          text-align: center;
          font-size: 0.8rem;
          color: #64748b;
          padding-top: 0.5rem;
        }

        .view-all-btn {
          width: 100%;
          margin-top: 1rem;
          padding: 0.5rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          color: #475569;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          transition: all 0.2s;
        }

        .view-all-btn:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: #10b981;
          animation: spin 1s linear infinite;
        }
        
        .generating-indicator .spinner-small {
          border-color: rgba(16, 185, 129, 0.3);
          border-top-color: #10b981;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        
        .modal-content {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        
        .shopping-list-modal {
          max-width: 600px;
        }
        
        .modal-header {
          padding: 1.25rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #1e293b;
        }
        
        .modal-close {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 50%;
          transition: all 0.2s;
        }
        
        .modal-close:hover {
          background: #f1f5f9;
          color: #ef4444;
        }
        
        .modal-body {
          padding: 1.25rem;
          overflow-y: auto;
        }
        
        .shopping-list-full {
          display: flex;
          flex-direction: column;
        }
        
        .full-row {
          padding: 0.75rem 0;
          align-items: center;
        }
        
        .shopping-total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1rem;
          margin-top: 0.5rem;
          border-top: 2px dashed #e2e8f0;
          font-weight: 700;
          color: #1e293b;
        }
        
        .total-price {
          font-size: 1.1rem;
          color: #10b981;
        }
        
        .modal-actions {
          padding: 1.25rem;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          background: #f8fafc;
          border-radius: 0 0 16px 16px;
        }
        
        .primary-btn-modern {
          background: #10b981;
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .primary-btn-modern:hover {
          background: #059669;
        }
        
        .secondary-btn {
          background: white;
          color: #64748b;
          border: 1px solid #e2e8f0;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .secondary-btn:hover {
          background: #f1f5f9;
          color: #334155;
        }

        @media (max-width: 768px) {
          .results-grid {
            grid-template-columns: 1fr;
          }
          
          .engine-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .engine-controls {
            width: 100%;
            justify-content: space-between;
            flex-wrap: wrap;
          }
          
          .control-group {
            flex: 1;
            min-width: 120px;
          }
          
          .input-with-icon input, .modern-select-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
