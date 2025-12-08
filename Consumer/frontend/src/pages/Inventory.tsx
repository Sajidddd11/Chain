import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';
import { api } from '../lib/api';
import type { InventoryItem, ScanReceiptResponse, DashboardData } from '../types';
import {
  Package,
  Plus,
  Sparkles,
  Search,
  Calendar,
  RefreshCw,
  FileText,
  Leaf,
  Camera,
  X,
  Loader2,
  Edit,
  Trash2,
  CalendarCheck,
  AlertTriangle
} from 'lucide-react';
import { MealOptimizationEngine } from '../components/MealOptimizationEngine';
import { RiskAnalysis } from '../components/RiskAnalysis';
import { NutrientGapPrediction } from '../components/NutrientGapPrediction';

const categoryOptions = [
  'Vegetable',
  'Fruit',
  'Dairy',
  'Protein',
  'Grain',
  'Pantry',
  'Snacks',
  'Beverage',
  'Frozen',
  'Other',
];

type TabType = 'inventory' | 'add' | 'alternatives' | 'meal-plan' | 'risk-analysis' | 'nutrient-gap';

export function Inventory() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [scanning, setScanning] = useState(false);
  // @ts-ignore - selectedFile is used for state management in receipt scanning
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    customName: '',
    quantity: '',
    unit: '',
    category: categoryOptions[0],
    expiresAt: '',
    notes: '',
    price: '',
  });
  const [updatingExpiry, setUpdatingExpiry] = useState(false);
  const [alternativesCache, setAlternativesCache] = useState<Map<string, any[]>>(new Map());
  const [loadingAlternatives, setLoadingAlternatives] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    customName: '',
    quantity: '',
    unit: '',
    category: categoryOptions[0],
    expiresAt: '',
    notes: '',
    price: '',
  });
  const [confirmAddToCart, setConfirmAddToCart] = useState<{
    show: boolean;
    product: any | null;
  }>({ show: false, product: null });
  const [updatingItem, setUpdatingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  // Load alternatives cache from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem('alternativesCache');
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        const cacheMap = new Map<string, any[]>(Object.entries(parsedCache));

        // Check if cache has old USD prices and clear if needed
        let hasOldPrices = false;
        for (const [itemName, alternatives] of cacheMap.entries()) {
          if (alternatives.some((alt: any) => alt.price && alt.price < 10)) {
            console.log(`Found old USD prices in cache for ${itemName}, will refresh`);
            hasOldPrices = true;
            break;
          }
        }

        if (hasOldPrices) {
          console.log('Clearing old cache with USD prices');
          localStorage.removeItem('alternativesCache');
          setAlternativesCache(new Map());
        } else {
          setAlternativesCache(cacheMap);
          console.log('Loaded alternatives cache from localStorage:', cacheMap.size, 'items');
        }
      } catch (err) {
        console.warn('Failed to parse alternatives cache from localStorage:', err);
        localStorage.removeItem('alternativesCache'); // Clear corrupted cache
      }
    } else {
      // Clear any old cache that might have USD prices
      clearAlternativesCache();
    }
  }, []);

  // Save alternatives cache to localStorage whenever it changes (with debouncing)
  useEffect(() => {
    if (alternativesCache.size > 0) {
      const cacheObject = Object.fromEntries(alternativesCache);
      localStorage.setItem('alternativesCache', JSON.stringify(cacheObject));
      console.log('Saved alternatives cache to localStorage:', alternativesCache.size, 'items');
    }
  }, [alternativesCache]);

  // Clear alternatives cache (useful when prices are updated)
  const clearAlternativesCache = () => {
    localStorage.removeItem('alternativesCache');
    setAlternativesCache(new Map());
    console.log('Cleared alternatives cache');
  };

  // Force refresh alternatives cache to ensure BDT prices
  const refreshAlternativesCache = () => {
    console.log('Force refreshing alternatives cache for BDT prices');
    clearAlternativesCache();
    // Small delay to ensure cache is cleared before reloading
    setTimeout(() => {
      loadAllAlternatives();
    }, 100);
  };

  const loadInventory = async (clearCache = false) => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await api.getInventory(token);
      setItems(response.items);
      // Only clear cache when explicitly requested (e.g., after adding/deleting items)
      if (clearCache) {
        console.log('Clearing alternatives cache due to inventory changes');
        localStorage.removeItem('alternativesCache');
        setAlternativesCache(new Map());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    if (!token) return;
    try {
      const response = await api.getDashboard(token);
      setDashboardData(response as DashboardData);
    } catch (err) {
      console.warn('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadInventory();
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Load alternatives when inventory changes
  useEffect(() => {
    if (items.length > 0) {
      loadAllAlternatives();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const clearCacheForItem = (itemName: string) => {
    setAlternativesCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(itemName);
      console.log(`Cleared cache for item: ${itemName}`);
      return newCache;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      const itemData: any = {
        customName: form.customName,
        quantity: form.quantity ? Number(form.quantity) : null,
        unit: form.unit,
        category: form.category,
        notes: form.notes,
        purchasedAt: new Date().toISOString().slice(0, 10),
        price: form.price ? Number(form.price) : null,
      };

      // Only include expiresAt if it's actually set
      if (form.expiresAt) {
        itemData.expiresAt = form.expiresAt;
      }

      await api.createInventoryItem(token, itemData);
      setForm({
        customName: '',
        quantity: '',
        unit: '',
        category: categoryOptions[0],
        expiresAt: '',
        notes: '',
        price: '',
      });
      // Clear cache only for the newly added item
      clearCacheForItem(form.customName);
      loadInventory(false); // Don't clear entire cache
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add item');
    }
  };

  const handleCancelAddToCart = () => {
    setConfirmAddToCart({ show: false, product: null });
  };

  const handleConfirmAddToCart = async () => {
    const product = confirmAddToCart.product;
    if (!product || !token) return;

    try {
      // Search for the product in the store
      const searchResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/store/products?search=${encodeURIComponent(product.name)}`);
      const searchData = await searchResponse.json();

      const foundProduct = searchData.products?.find((p: any) =>
        p.name.toLowerCase().includes(product.name.toLowerCase()) ||
        product.name.toLowerCase().includes(p.name.toLowerCase())
      );

      if (!foundProduct) {
        showToast('error', `${product.name} not found in store`);
        setConfirmAddToCart({ show: false, product: null });
        return;
      }

      // Update the modal with the real product data (including image)
      setConfirmAddToCart({ show: true, product: foundProduct });

      // Add to cart
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ product_id: foundProduct.id, quantity: 1 })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      showToast('success', `${product.name} added to cart!`);
      setConfirmAddToCart({ show: false, product: null });
    } catch (error: any) {
      showToast('error', error.message || 'Failed to add to cart');
      setConfirmAddToCart({ show: false, product: null });
    }
  };

  const handleSaveExtracted = async () => {
    if (!token || extractedItems.length === 0) return;

    try {
      // Add each extracted item to inventory
      for (const item of extractedItems) {
        const itemData: any = {
          customName: item.name,
          quantity: item.quantity ? Number(item.quantity) : null,
          unit: item.unit || '',
          category: 'Other', // Default category
          notes: 'Added from receipt scan',
          purchasedAt: new Date().toISOString().slice(0, 10),
          price: item.price ? Number(item.price) : null,
        };

        await api.createInventoryItem(token, itemData);
      }

      // Clear the extracted items and reset the scan
      setExtractedItems([]);
      setSelectedFile(null);
      setPreviewUrl(null);

      // Reload inventory to show the new items
      loadInventory(false);

      showToast('success', `Added ${extractedItems.length} items to your pantry!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save extracted items');
    }
  };

  const handleScan = async (file: File) => {
    if (!token) return;

    setScanning(true);
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setExtractedItems([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response: ScanReceiptResponse = await api.scanReceipt(token, formData);
      const normalizedItems =
        response.items?.map((item) => ({
          ...item,
          price: item.price !== undefined && item.price !== null ? Number(item.price) : null,
        })) ?? [];
      setExtractedItems(normalizedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan receipt');
    } finally {
      setScanning(false);
    }
  };

  const updateMissingExpiryDates = async () => {
    if (!token) return;

    setUpdatingExpiry(true);
    setError(null);

    try {
      await api.updateMissingExpiryDates(token);
      loadInventory(false); // Don't clear cache when updating expiry dates
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update expiry dates');
    } finally {
      setUpdatingExpiry(false);
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      customName: item.custom_name || '',
      quantity: item.quantity?.toString() || '',
      unit: item.unit || '',
      category: item.category,
      expiresAt: item.expires_at ? item.expires_at.split('T')[0] : '',
      notes: item.notes || '',
      price: item.price?.toString() || '',
    });
  };

  const handleUpdateItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !editingItem) return;

    setUpdatingItem(true);
    setError(null);

    try {
      const itemData: any = {
        customName: editForm.customName,
        quantity: editForm.quantity ? Number(editForm.quantity) : null,
        unit: editForm.unit,
        category: editForm.category,
        notes: editForm.notes,
        price: editForm.price ? Number(editForm.price) : null,
      };

      if (editForm.expiresAt) {
        itemData.expiresAt = editForm.expiresAt;
      }

      await api.updateInventoryItem(token, editingItem.id, itemData);

      // Clear cache for the updated item
      clearCacheForItem(editForm.customName);
      loadInventory(false); // Don't clear entire cache
      setEditingItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setUpdatingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!token) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${itemName}" from your inventory?`);
    if (!confirmed) return;

    setDeletingItem(itemId);
    setError(null);

    try {
      await api.deleteInventoryItem(token, itemId);
      loadInventory(true); // Clear cache when deleting items
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setDeletingItem(null);
    }
  };

  // Load alternatives for all items automatically
  const loadAllAlternatives = async () => {
    if (!token || items.length === 0) return;

    console.log('Loading alternatives for', items.length, 'items. Current cache size:', alternativesCache.size);

    const uncachedItems = items.filter(item => {
      const itemName = item.custom_name || item.food_item?.name || 'Unknown';
      const isCached = alternativesCache.has(itemName);
      console.log(`Item "${itemName}" is ${isCached ? 'cached' : 'not cached'}`);
      return !isCached;
    });

    console.log('Found', uncachedItems.length, 'uncached items');

    if (uncachedItems.length === 0) {
      console.log('All alternatives are already cached, skipping API calls');
      return;
    }

    // Mark items as loading
    const loadingItemNames = new Set(uncachedItems.map(item => item.custom_name || item.food_item?.name || 'Unknown'));
    setLoadingAlternatives(prev => new Set([...prev, ...loadingItemNames]));

    // Load alternatives for uncached items in parallel
    const promises = uncachedItems.map(async (item) => {
      const itemName = item.custom_name || item.food_item?.name || 'Unknown';
      try {
        console.log(`Fetching alternatives for: ${itemName}`);
        const response = await api.getAlternatives(token, itemName);
        console.log(`Got ${response.alternatives?.length || 0} alternatives for: ${itemName}`);

        // Ensure all alternatives have BDT prices
        const alternativesWithBDTPrices = response.alternatives?.map(alt => {
          // If API returns null price or price seems too low (likely USD), use mock data pricing
          if (!alt.price || alt.price < 10) { // Assuming prices under 10 are likely USD
            // Try to find matching mock data for BDT pricing
            const mockAlternatives = generateMockAlternatives(itemName);
            const mockMatch = mockAlternatives.find(mock =>
              mock.name.toLowerCase().includes(alt.name.toLowerCase()) ||
              alt.name.toLowerCase().includes(mock.name.toLowerCase())
            );

            if (mockMatch) {
              return {
                ...alt,
                price: mockMatch.price,
                savings: mockMatch.savings
              };
            }
          }

          // If price seems reasonable (likely already BDT), keep it
          // Convert USD to BDT if price is very low (rough conversion: 1 USD ≈ 120 BDT)
          const convertedPrice = alt.price && alt.price < 50 ? alt.price * 120 : alt.price;

          return {
            ...alt,
            price: convertedPrice
          };
        }) || [];

        return { itemName, alternatives: alternativesWithBDTPrices };
      } catch (err) {
        console.warn(`Failed to load alternatives for ${itemName}, using mock data:`, err);
        const mockAlternatives = generateMockAlternatives(itemName);
        return { itemName, alternatives: mockAlternatives };
      }
    });

    try {
      const results = await Promise.all(promises);
      console.log('Loaded alternatives for', results.length, 'items');

      setAlternativesCache(prev => {
        const newCache = new Map(prev);
        results.forEach(({ itemName, alternatives }) => {
          newCache.set(itemName, alternatives);
          console.log(`Cached ${alternatives.length} alternatives for: ${itemName}`);
        });
        console.log('Updated cache now has', newCache.size, 'items');
        return newCache;
      });
    } catch (err) {
      console.error('Failed to load alternatives for some items:', err);
    } finally {
      // Remove loading state for all items that were being loaded
      setLoadingAlternatives(prev => {
        const newSet = new Set(prev);
        loadingItemNames.forEach(name => newSet.delete(name));
        return newSet;
      });
    }
  };

  const generateMockAlternatives = (itemName: string) => {
    // Mock alternative foods with similar nutritional value but lower cost
    const alternativesMap: { [key: string]: any[] } = {
      'chicken breast': [
        {
          name: 'Chicken Thigh',
          calories: 180,
          price: 420.00, // BDT equivalent
          savings: 144.00,
          reason: 'Similar protein content, more affordable',
          product_id: null // Will be searched by name
        },
        {
          name: 'Turkey Breast',
          calories: 160,
          price: 480.00, // BDT equivalent
          savings: 84.00,
          reason: 'Lean protein alternative, good value',
          product_id: null
        },
        {
          name: 'Eggs (6-pack)',
          calories: 420,
          price: 300.00, // BDT equivalent
          savings: 264.00,
          reason: 'High protein, very cost-effective',
          product_id: null
        }
      ],
      'beef steak': [
        {
          name: 'Ground Beef (80% lean)',
          calories: 250,
          price: 540.00, // BDT equivalent
          savings: 300.00,
          reason: 'Good protein content, much cheaper per lb'
        },
        {
          name: 'Chicken Breast',
          calories: 165,
          price: 479.00, // BDT equivalent
          savings: 361.00,
          reason: 'Lean protein alternative, significant savings'
        },
        {
          name: 'Lentils (1 lb)',
          calories: 680,
          price: 180.00, // BDT equivalent
          savings: 540.00,
          reason: 'Plant-based protein, very affordable'
        }
      ],
      'salmon fillet': [
        {
          name: 'Canned Tuna',
          calories: 120,
          price: 239.00, // BDT equivalent
          savings: 361.00,
          reason: 'Omega-3 rich, very cost-effective'
        },
        {
          name: 'Tilapia Fillet',
          calories: 130,
          price: 599.00, // BDT equivalent
          savings: 1.00,
          reason: 'Mild white fish, similar texture'
        },
        {
          name: 'Eggs (12-pack)',
          calories: 840,
          price: 479.00, // BDT equivalent
          savings: 121.00,
          reason: 'High protein, excellent value'
        }
      ],
      'avocado': [
        {
          name: 'Banana',
          calories: 105,
          price: 60.00, // BDT equivalent
          savings: 120.00,
          reason: 'Healthy fats, potassium rich, very affordable'
        },
        {
          name: 'Peanut Butter (2 tbsp)',
          calories: 190,
          price: 90.00, // BDT equivalent
          savings: 90.00,
          reason: 'Healthy fats, good calories per dollar'
        },
        {
          name: 'Olive Oil (1 tbsp)',
          calories: 120,
          price: 36.00, // BDT equivalent
          savings: 144.00,
          reason: 'Healthy fats, very cost-effective'
        }
      ],
      'almonds': [
        {
          name: 'Peanuts',
          calories: 160,
          price: 180.00, // BDT equivalent
          savings: 120.00,
          reason: 'Similar nutrition, much cheaper'
        },
        {
          name: 'Sunflower Seeds',
          calories: 140,
          price: 240.00, // BDT equivalent
          savings: 60.00,
          reason: 'Healthy fats, good protein content'
        },
        {
          name: 'Oatmeal (1 cup cooked)',
          calories: 150,
          price: 90.00, // BDT equivalent
          savings: 210.00,
          reason: 'Complex carbs, very affordable'
        }
      ],
      'greek yogurt': [
        {
          name: 'Regular Yogurt',
          calories: 150,
          price: 300.00, // BDT equivalent
          savings: 180.00,
          reason: 'Similar protein, much cheaper'
        },
        {
          name: 'Cottage Cheese',
          calories: 160,
          price: 359.00, // BDT equivalent
          savings: 121.00,
          reason: 'High protein, good value'
        },
        {
          name: 'Eggs (4-pack)',
          calories: 280,
          price: 180.00, // BDT equivalent
          savings: 300.00,
          reason: 'High protein, excellent value'
        }
      ],
      'quinoa': [
        {
          name: 'Brown Rice',
          calories: 215,
          price: 180.00, // BDT equivalent
          savings: 120.00,
          reason: 'Complex carbs, very affordable'
        },
        {
          name: 'Oats',
          calories: 150,
          price: 240.00, // BDT equivalent
          savings: 60.00,
          reason: 'Nutritious grains, good value'
        },
        {
          name: 'Lentils',
          calories: 230,
          price: 150.00, // BDT equivalent
          savings: 150.00,
          reason: 'Plant protein, excellent value'
        }
      ]
    };

    // Default alternatives for unknown items
    const defaultAlternatives = [
      {
        name: 'Generic Alternative 1',
        calories: 150,
        price: 240.00, // BDT equivalent
        savings: 180.00,
        reason: 'Cost-effective alternative with similar nutritional value'
      },
      {
        name: 'Generic Alternative 2',
        calories: 180,
        price: 210.00, // BDT equivalent
        savings: 210.00,
        reason: 'Budget-friendly option with good calorie density'
      },
      {
        name: 'Generic Alternative 3',
        calories: 120,
        price: 150.00, // BDT equivalent
        savings: 270.00,
        reason: 'Very affordable choice with reasonable calories'
      }
    ];

    const itemKey = itemName.toLowerCase();
    return alternativesMap[itemKey] || defaultAlternatives;
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = (item.custom_name || item.food_item?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="inventory-page">
      <div className="page-header-modern">
        <div>
          <h2>Inventory Management</h2>
          <p className="subtitle">Track your pantry, reduce waste, and save money</p>
        </div>
        <div className="header-stats">
          <div className="stat-pill">
            <span className="stat-value">{items.length}</span>
            <span className="stat-label">Items</span>
          </div>
          <div className="stat-pill warning">
            <span className="stat-value">
              {items.filter(i => i.expires_at && new Date(i.expires_at) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)).length}
            </span>
            <span className="stat-label">Expiring Soon</span>
          </div>
          <div className="stat-pill success">
            <span className="stat-value">
              BDT {items.reduce((total, item) => {
                const price = item.price !== null && item.price !== undefined ? Number(item.price) : 0;
                return total + (isNaN(price) ? 0 : price);
              }, 0).toFixed(2)}
            </span>
            <span className="stat-label">Total Value</span>
          </div>
        </div>
      </div>

      <div className="card budget-usage-card" style={{ marginBottom: '1.5rem' }}>
        <div className="budget-card-header">
          <h3>Budget utilization</h3>
          {dashboardData?.budgetUsage?.budgetAmount && (
            <span className="budget-period-chip">Tracking {dashboardData.budgetUsage.periodLabel}</span>
          )}
        </div>
        {loading ? (
          <p>Crunching numbers…</p>
        ) : dashboardData?.budgetUsage && dashboardData.budgetUsage.budgetAmount ? (
          <div className="budget-usage-body">
            {(() => {
              const clampedPercent = Math.min(Math.max(dashboardData.budgetUsage.percentage, 0), 100);
              const ringStyle = {
                background: `conic-gradient(var(--green-900) ${clampedPercent}%, rgba(31, 122, 77, 0.1) ${clampedPercent}% 100%)`,
              };
              return (
                <>
                  <div className="budget-ring" style={ringStyle}>
                    <div className="budget-ring__inner">
                      <strong>{Math.round(clampedPercent)}%</strong>
                      <small>used</small>
                    </div>
                  </div>
                  <div className="budget-details">
                    <p className="budget-amount">
                      <strong>BDT {dashboardData.budgetUsage.used.toFixed(2)}</strong> of{' '}
                      <span>BDT {dashboardData.budgetUsage.budgetAmount.toFixed(2)}</span>
                    </p>
                    <p className="budget-remaining">
                      Remaining: <strong>BDT {dashboardData.budgetUsage.remaining.toFixed(2)}</strong>
                    </p>
                    <p className="budget-meta">
                      Tracking since {new Date(dashboardData.budgetUsage.since).toLocaleDateString()}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="budget-empty-state">
            <p>
              Track your food spending and stay within budget. Set a household budget to visualize
              how inventory purchases impact your limits.
            </p>
            <button
              className="primary-btn"
              onClick={() => {
                window.location.hash = '#/profile';
              }}
            >
              Set Budget
            </button>
          </div>
        )}
      </div>

      <div className="inventory-tabs">
        <button
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <Package size={18} className="mr-2" /> My Pantry
        </button>
        <button
          className={`tab-btn ${activeTab === 'meal-plan' ? 'active' : ''}`}
          onClick={() => setActiveTab('meal-plan')}
        >
          <CalendarCheck size={18} className="mr-2" /> Meal Plan
        </button>
        <button
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <Plus size={18} className="mr-2" /> Add Items
        </button>
        <button
          className={`tab-btn ${activeTab === 'risk-analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('risk-analysis')}
        >
          <AlertTriangle size={18} className="mr-2" /> Risk Analysis
        </button>
        <button
          className={`tab-btn ${activeTab === 'nutrient-gap' ? 'active' : ''}`}
          onClick={() => setActiveTab('nutrient-gap')}
        >
          <Sparkles size={18} className="mr-2" /> Nutrient Gap
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'inventory' && (
          <div className="inventory-view animate-fade-in">
            <div className="filters-bar">
              <div className="search-wrapper">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search your pantry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="modern-input search-input"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="modern-select"
              >
                <option value="All">All Categories</option>
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                className="refresh-btn-icon"
                onClick={updateMissingExpiryDates}
                disabled={updatingExpiry}
                title="Update Missing Expiry Dates"
                style={{ marginRight: '0.5rem' }}
              >
                {updatingExpiry ? <Loader2 size={20} className="animate-spin" /> : <Calendar size={20} />}
              </button>
              <button
                className="refresh-btn-icon"
                onClick={() => loadInventory(true)}
                disabled={loading}
                title="Refresh Inventory"
              >
                <RefreshCw size={20} />
              </button>
              <button
                className="refresh-btn-icon"
                onClick={refreshAlternativesCache}
                disabled={loading}
                title="Refresh Alternatives Cache"
                style={{ marginLeft: '0.5rem' }}
              >
                <Sparkles size={20} />
              </button>
            </div>

            {error && (
              <div style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #fed7d7' }}>
                {error}
              </div>
            )}

            {loading ? (
              <div className="loading-state-modern">
                <div className="spinner-modern"></div>
                <p>Loading your pantry...</p>
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="inventory-grid-compact">
                {filteredItems.map((item) => {
                  const rawPrice = item.price !== null && item.price !== undefined ? Number(item.price) : null;
                  const itemPrice = rawPrice !== null && !Number.isNaN(rawPrice) ? rawPrice : null;
                  const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
                  const isExpiringSoon = item.expires_at && !isExpired && new Date(item.expires_at) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                  const isExpiringWeek = item.expires_at && !isExpired && !isExpiringSoon && new Date(item.expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                  let statusClass = 'fresh';
                  let statusText = 'Fresh';

                  if (isExpired) {
                    statusClass = 'expired';
                    statusText = 'Expired';
                  } else if (isExpiringSoon) {
                    statusClass = 'expiring-soon';
                    statusText = 'Expiring Soon';
                  } else if (isExpiringWeek) {
                    statusClass = 'expiring-week';
                    statusText = 'Use This Week';
                  }

                  const itemName = item.custom_name || item.food_item?.name || 'Unknown';
                  const itemAlternatives = alternativesCache.get(itemName) || [];
                  const isLoadingAlternatives = loadingAlternatives.has(itemName);

                  return (
                    <div key={item.id} className={`inventory-card-integrated ${statusClass}-border`}>
                      <div className="card-main-content">
                        <div className="card-top">
                          <span className="category-badge">{item.category}</span>
                          {item.expires_at && (
                            <span className={`expiry-badge ${statusClass}`}>
                              {statusText}
                            </span>
                          )}
                        </div>
                        <h3 className="item-title">{itemName}</h3>

                        <div className="item-meta-row">
                          <div className="meta-item">
                            <span className="label">Qty</span>
                            <span className="value">{item.quantity ?? '—'} {item.unit}</span>
                          </div>
                          <div className="meta-item">
                            <span className="label">Expires</span>
                            <span className="value">
                              {item.expires_at ? new Date(item.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                            </span>
                          </div>
                          {itemPrice !== null && (
                            <div className="meta-item price-meta">
                              <span className="label">Price</span>
                              <span className="value price-value">BDT {itemPrice.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {item.notes && (
                          <div className="item-notes-compact">
                            <FileText size={14} />
                            <p>{item.notes}</p>
                          </div>
                        )}

                        <div className="item-actions">
                          <button
                            className="action-btn edit-btn"
                            onClick={() => handleEditItem(item)}
                            title="Edit item"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteItem(item.id, itemName)}
                            disabled={deletingItem === item.id}
                            title="Delete item"
                          >
                            {deletingItem === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Integrated Alternatives */}
                      {isLoadingAlternatives ? (
                        <div className="alternatives-integrated">
                          <div className="alternatives-header-compact">
                            <Sparkles size={14} />
                            <span>Loading cheaper options...</span>
                          </div>
                          <div className="alternatives-compact-list">
                            {[1, 2].map((idx) => (
                              <div key={idx} className="alt-compact-item skeleton">
                                <div className="alt-compact-info">
                                  <div className="skeleton-text skeleton-name"></div>
                                  <div className="skeleton-text skeleton-price"></div>
                                </div>
                                <div className="skeleton-button"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : itemAlternatives.length > 0 ? (
                        <div className="alternatives-integrated">
                          <div className="alternatives-header-compact">
                            <Sparkles size={14} />
                            <span>Cheaper Options</span>
                          </div>
                          <div className="alternatives-compact-list">
                            {itemAlternatives.slice(0, 2).map((alt: any, idx: number) => (
                              <div key={idx} className="alt-compact-item">
                                <div className="alt-compact-info">
                                  <span className="alt-compact-name">{alt.name}</span>
                                  <span className="alt-compact-price">
                                    BDT {alt.price?.toFixed(2) || 'N/A'}
                                  </span>
                                  {alt.savings && (
                                    <span className="alt-compact-savings">-BDT {alt.savings.toFixed(2)}</span>
                                  )}
                                </div>
                                <button
                                  className="add-cart-compact"
                                  onClick={() => {
                                    setConfirmAddToCart({ show: true, product: alt });
                                  }}
                                  title={`Add ${alt.name} to cart`}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state-modern">
                <div className="empty-illustration"><Leaf size={64} color="#48bb78" /></div>
                <h3>No items found</h3>
                <p>Try adjusting your filters or add new items to your pantry.</p>
                <button className="primary-btn-modern" onClick={() => setActiveTab('add')}>
                  Add First Item
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="add-item-view animate-fade-in">
            <div className="add-layout">
              <div className="manual-add-card">
                <h3>Manual Entry</h3>
                <form onSubmit={handleSubmit} className="modern-form">
                  <div className="form-group">
                    <label>Item Name</label>
                    <input
                      required
                      placeholder="e.g., Organic Bananas"
                      value={form.customName}
                      onChange={(e) => setForm((prev) => ({ ...prev, customName: e.target.value }))}
                      className="modern-input"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Quantity</label>
                      <input
                        placeholder="0"
                        value={form.quantity}
                        onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                        className="modern-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <input
                        placeholder="kg, pcs..."
                        value={form.unit}
                        onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                        className="modern-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                        className="modern-select"
                      >
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Price (BDT)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.price}
                        onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                        className="modern-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                      className="modern-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Notes (Optional)</label>
                    <textarea
                      placeholder="Storage instructions, brand, etc."
                      value={form.notes}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                      className="modern-textarea"
                    />
                  </div>

                  <button className="primary-btn-modern full-width" type="submit">
                    Save to Pantry
                  </button>
                </form>
              </div>

              <div className="scan-add-card">
                <h3>Scan Receipt</h3>
                <p className="scan-desc">Upload a photo of your grocery receipt to automatically extract items.</p>

                <div className="scan-area">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handleScan(e.target.files[0])}
                    style={{ display: 'none' }}
                    id="receipt-scan-modern"
                  />

                  {!previewUrl ? (
                    <div
                      className="upload-placeholder"
                      onClick={() => document.getElementById('receipt-scan-modern')?.click()}
                    >
                      <div className="upload-icon"><Camera size={48} /></div>
                      <span>Click to upload receipt</span>
                    </div>
                  ) : (
                    <div className="preview-container">
                      <img src={previewUrl} alt="Receipt" className="modern-preview-img" />
                      <button
                        className="remove-preview"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          setExtractedItems([]);
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>
                  )}

                  {scanning && (
                    <div className="scanning-status">
                      <div className="spinner-modern small"></div>
                      <span>Analyzing receipt...</span>
                    </div>
                  )}

                  {!scanning && extractedItems.length > 0 && (
                    <div className="extracted-results">
                      <h4>Found {extractedItems.length} Items</h4>
                      <div className="extracted-list-modern">
                        {extractedItems.map((item, index) => (
                          <div key={index} className="extracted-item-modern">
                            <div className="extracted-item-info">
                              <span className="item-name">{item.name}</span>
                              <span className="item-qty">{item.quantity} {item.unit}</span>
                            </div>
                            {item.price && (
                              <span className="item-price">BDT {Number(item.price).toFixed(2)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="extracted-total">
                        <span>Total:</span>
                        <span className="total-amount">
                          BDT {extractedItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0).toFixed(2)}
                        </span>
                      </div>
                      <button className="primary-btn-modern full-width" onClick={handleSaveExtracted}>
                        Confirm & Save All
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'meal-plan' && (
          <MealOptimizationEngine />
        )}

        {activeTab === 'risk-analysis' && (
          <RiskAnalysis
            items={items}
            logs={dashboardData?.recentLogs || []}
          />
        )}

        {activeTab === 'nutrient-gap' && (
          <NutrientGapPrediction />
        )}

      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content edit-modal" onClick={(e) => e.target === e.currentTarget || e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Item</h3>
              <button className="modal-close" onClick={() => setEditingItem(null)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdateItem} className="modal-form">
              <div className="form-group">
                <label>Item Name</label>
                <input
                  required
                  placeholder="e.g., Organic Bananas"
                  value={editForm.customName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, customName: e.target.value }))}
                  className="modern-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    placeholder="0"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="modern-input"
                  />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input
                    placeholder="kg, pcs..."
                    value={editForm.unit}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                    className="modern-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="modern-select"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Price (BDT)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editForm.price}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="modern-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Expiry Date</label>
                <input
                  type="date"
                  value={editForm.expiresAt}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                  className="modern-input"
                />
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  placeholder="Storage instructions, brand, etc."
                  value={editForm.notes}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="modern-textarea"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn-modern"
                  disabled={updatingItem}
                >
                  {updatingItem ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    'Update Item'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmAddToCart.show && confirmAddToCart.product && (
        <div className="confirmation-modal-overlay">
          <div className="confirmation-modal-content">
            <div className="confirmation-modal-header">
              <h3>Add to Cart</h3>
            </div>
            <div className="confirmation-modal-body">
              <div className="confirmation-product-info">
                <div className="confirmation-product-name">
                  {confirmAddToCart.product.name}
                </div>
                <div className="confirmation-product-price">
                  BDT {confirmAddToCart.product.price?.toFixed(2)}
                </div>
                {confirmAddToCart.product.savings && (
                  <div className="confirmation-product-savings">
                    Save BDT {confirmAddToCart.product.savings.toFixed(2)}
                  </div>
                )}
              </div>
              <div className="confirmation-message">
                Add this item to your cart?
              </div>
            </div>
            <div className="confirmation-modal-actions">
              <button
                className="confirmation-cancel-btn"
                onClick={handleCancelAddToCart}
              >
                Cancel
              </button>
              <button
                className="confirmation-confirm-btn"
                onClick={handleConfirmAddToCart}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

