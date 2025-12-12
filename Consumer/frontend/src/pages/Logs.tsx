import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { ConsumptionLog, InventoryItem } from '../types';
import { Utensils, Package, Sparkles, ChevronDown, Save, AlertCircle } from 'lucide-react';
import { UsageCounter } from '../components/UsageCounter';
import { useUsageStats } from '../hooks/useUsageStats';

export function Logs() {
  const { token } = useAuth();
  const { getFeatureStats, isFeatureLocked, isPremium, fetchUsageStats } = useUsageStats();
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [usageSelections, setUsageSelections] = useState<Record<string, number>>({});
  const [aiForm, setAiForm] = useState({
    dishes: '',
    servings: '',
    audience: '',
  });
  const [_aiMissingItems, setAiMissingItems] = useState<
    Array<{ name: string; suggested_quantity?: string | null; note: string }>
  >([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('week');
  const [showAnalytics] = useState(true); // Default to true for the new layout

  const fetchLogs = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await api.getLogs(token);
      setLogs(response.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    if (!token) return;
    try {
      const response = await api.getInventory(token);
      setInventoryItems(response.items);
      setUsageSelections({});
    } catch (err) {
      console.error('Failed to load inventory for usage', err);
    }
  };

  const fetchAnalytics = async () => {
    if (!token) return;

    // Check if feature is locked
    if (isFeatureLocked('analytics')) {
      return;
    }

    try {
      setAnalyticsLoading(true);
      const response = await api.getConsumptionPatterns(token, analyticsPeriod);
      setAnalyticsData(response);
      // Refresh usage stats after successful API call
      fetchUsageStats();
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (showAnalytics) {
      fetchAnalytics();
    }
  }, [showAnalytics, analyticsPeriod]);

  const handleSliderChange = (item: InventoryItem, value: string) => {
    const numeric = Number(value);
    setUsageSelections((prev) => ({
      ...prev,
      [item.id]: numeric,
    }));
  };

  const totalSelections = Object.entries(usageSelections).filter(([, amount]) => amount > 0);

  const handleBulkSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    if (!totalSelections.length) {
      setError('Set at least one usage amount.');
      return;
    }

    setError(null);
    try {
      for (const [inventoryItemId, quantity] of totalSelections) {
        await api.createLog(token, {
          inventoryItemId,
          quantity,
          notes,
        });
      }
      setNotes('');
      setUsageSelections({});
      await fetchLogs();
      await fetchInventory();
      if (showAnalytics) await fetchAnalytics();
      // Clear nutrient analysis cache so it refreshes with new consumption data
      api.clearNutrientCache(token);
      // Clear SDG cache as consumption affects nutrition score
      api.clearSDGCache(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save usage');
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Usage & Analytics</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Track consumption and view insights</p>
      </div>

      {/* Track Consumption Section */}
      <div className="card" style={{
        marginBottom: '2rem',
        padding: '0',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(to right, #f0fdf4, #ffffff)',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#16a34a',
              borderRadius: '0.75rem',
              color: 'white',
              boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)'
            }}>
              <Utensils size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>Track Consumption</h3>
              <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                Log what you've used to keep your inventory and nutrition insights accurate.
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Chef AI Section */}
            <div className="ai-assistant-panel" style={{
              backgroundColor: '#f8fafc',
              borderRadius: '1rem',
              border: '1px dashed #cbd5e1',
              padding: '0.5rem',
              transition: 'all 0.2s ease'
            }}>
              <button
                type="button"
                className="ai-plan__toggle"
                onClick={() => setAiOpen((prev) => !prev)}
                style={{ width: '100%', padding: '0.75rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                    }}>
                      <Sparkles size={20} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <h4 style={{ fontSize: '1rem', marginBottom: '0.1rem', fontWeight: '700', color: '#1e293b' }}>Ask Chef AI</h4>
                      <p style={{ fontSize: '0.85rem', margin: 0, color: '#64748b' }}>
                        {aiOpen ? 'Describe your meal to auto-fill usage' : 'Get smart suggestions based on what you cooked'}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    color: '#16a34a',
                    backgroundColor: '#dcfce7',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    transition: 'transform 0.2s ease',
                    transform: aiOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    <ChevronDown size={20} />
                  </div>
                </div>
              </button>

              {aiOpen && (
                <div className="ai-plan__form animate-fade-in" style={{ padding: '0 1rem 1rem 1rem', marginTop: '0.5rem' }}>
                  <textarea
                    placeholder="e.g., I made a large vegetable curry with 2 onions, 3 potatoes, and some spinach..."
                    value={aiForm.dishes}
                    onChange={(e) => setAiForm((prev) => ({ ...prev, dishes: e.target.value }))}
                    style={{
                      minHeight: '100px',
                      fontSize: '0.95rem',
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      border: '1px solid #e2e8f0',
                      width: '100%',
                      marginBottom: '1rem',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Servings</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g., 4"
                        value={aiForm.servings}
                        onChange={(e) => setAiForm((prev) => ({ ...prev, servings: e.target.value }))}
                        style={{ fontSize: '0.9rem', padding: '0.75rem', width: '100%', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Audience</label>
                      <input
                        placeholder="e.g., Family of 4"
                        value={aiForm.audience}
                        onChange={(e) => setAiForm((prev) => ({ ...prev, audience: e.target.value }))}
                        style={{ fontSize: '0.9rem', padding: '0.75rem', width: '100%', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="primary-btn"
                    style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', justifyContent: 'center' }}
                    disabled={aiStatus === 'loading'}
                    onClick={async () => {
                      if (!token) return;
                      const dishes = aiForm.dishes.split(',').map((d) => d.trim()).filter(Boolean);
                      if (!dishes.length) {
                        setAiError('Enter at least one dish.');
                        return;
                      }
                      setAiStatus('loading');
                      setAiError(null);
                      try {
                        const response = await api.requestUsagePlan(token, {
                          dishes,
                          servings: aiForm.servings ? Number(aiForm.servings) : undefined,
                          audience: aiForm.audience || undefined,
                        });
                        const newSelections: Record<string, number> = {};
                        response.suggestions.forEach((suggestion) => {
                          const item = inventoryItems.find((inv) => inv.id === suggestion.inventory_item_id);
                          if (!item || item.quantity == null) return;
                          const amount = Math.min(suggestion.amount_to_use, Number(item.quantity));
                          if (amount > 0) newSelections[item.id] = amount;
                        });
                        setUsageSelections((prev) => ({ ...prev, ...newSelections }));
                        setAiMissingItems(response.missing_items || []);
                        setAiStatus('idle');
                        setAiOpen(false); // Close after success
                      } catch (err) {
                        console.error(err);
                        setAiStatus('error');
                        setAiError('AI plan failed');
                      }
                    }}
                  >
                    {aiStatus === 'loading' ? (
                      <>
                        <Sparkles size={18} className="animate-spin" /> Analyzing Recipe...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} /> Auto-fill Usage
                      </>
                    )}
                  </button>
                  {aiError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', color: '#ef4444', fontSize: '0.9rem' }}>
                      <AlertCircle size={16} /> {aiError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inventory Grid */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '1.1rem', color: '#334155', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Package size={20} color="#16a34a" /> Select Items
                </h4>
                <span style={{ fontSize: '0.9rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
                  {inventoryItems.length} items available
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '1.25rem',
                maxWidth: '100%'
              }}>
                {inventoryItems.length ? (
                  inventoryItems.map((item) => {
                    const max = item.quantity ?? 0;
                    const value = usageSelections[item.id] ?? 0;
                    const isSelected = value > 0;
                    const expiresAtDate = item.expires_at ? new Date(item.expires_at) : null;
                    const now = new Date();
                    const threeDaysOut = new Date();
                    threeDaysOut.setDate(now.getDate() + 3);
                    let statusLabel: string | null = null;
                    let statusClass: 'expired' | 'expiring-soon' | null = null;

                    if (expiresAtDate) {
                      if (expiresAtDate < now) {
                        statusLabel = 'Expired';
                        statusClass = 'expired';
                      } else if (expiresAtDate <= threeDaysOut) {
                        statusLabel = 'Expiring Soon';
                        statusClass = 'expiring-soon';
                      }
                    }

                    return (
                      <div key={item.id} style={{
                        padding: '1.25rem',
                        backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                        border: `1px solid ${isSelected ? '#16a34a' : '#e2e8f0'}`,
                        borderRadius: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 4px 12px rgba(22, 163, 74, 0.15)' : '0 2px 4px rgba(0,0,0,0.03)',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: '700',
                              color: '#0f172a',
                              fontSize: '1rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginBottom: '0.25rem'
                            }} title={item.custom_name || item.food_item?.name || 'Unnamed'}>
                              {item.custom_name || item.food_item?.name || 'Unnamed'}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                              Available: <span style={{ fontWeight: '600', color: '#334155' }}>{max} {item.unit}</span>
                            </div>
                          </div>
                          {statusLabel && (
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.35rem',
                              backgroundColor: statusClass === 'expired' ? '#fee2e2' : '#fef3c7',
                              color: statusClass === 'expired' ? '#991b1b' : '#92400e',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.025em'
                            }}>
                              {statusLabel}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ flex: 1 }}>
                            <input
                              type="range"
                              min="0"
                              max={max}
                              step="0.1"
                              value={value}
                              disabled={max === 0}
                              onChange={(e) => handleSliderChange(item, e.target.value)}
                              style={{
                                width: '100%',
                                height: '6px',
                                accentColor: '#16a34a',
                                cursor: max === 0 ? 'not-allowed' : 'pointer',
                                display: 'block'
                              }}
                            />
                          </div>
                          <div style={{
                            minWidth: '60px',
                            textAlign: 'right',
                            fontWeight: '700',
                            fontSize: '1.1rem',
                            color: isSelected ? '#16a34a' : '#cbd5e1'
                          }}>
                            {value}
                          </div>
                        </div>

                        {isSelected && (
                          <div style={{
                            fontSize: '0.8rem',
                            color: '#16a34a',
                            fontWeight: '600',
                            textAlign: 'center',
                            backgroundColor: 'rgba(22, 163, 74, 0.1)',
                            padding: '0.25rem',
                            borderRadius: '0.5rem'
                          }}>
                            Using {((value / max) * 100).toFixed(0)}% of stock
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
                    <Package size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#475569' }}>Your pantry is empty</p>
                    <p style={{ fontSize: '0.9rem' }}>Add items to your inventory to start tracking consumption.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{
              paddingTop: '1.5rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Notes (Optional)</label>
                <input
                  placeholder="e.g., Used for Sunday family dinner..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    fontSize: '0.95rem',
                    padding: '0.8rem 1rem',
                    width: '100%',
                    borderRadius: '0.75rem',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc'
                  }}
                />
              </div>
              <button
                type="submit"
                className="primary-btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '1rem',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.3)'
                }}
                disabled={totalSelections.length === 0}
              >
                <Save size={20} /> Save Usage Log ({totalSelections.length} items)
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        {/* Usage Counter for Analytics */}
        {(() => {
          const stats = getFeatureStats('analytics');
          if (stats) {
            return (
              <UsageCounter
                feature="analytics"
                currentUsage={stats.currentUsage}
                limit={stats.limit}
                isPremium={isPremium}
                onUpgradeClick={() => {}}
              />
            );
          }
          return null;
        })()}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Consumption Analytics</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Insights based on your usage history</p>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
            {['week', 'month'].map((period) => (
              <button
                key={period}
                onClick={() => setAnalyticsPeriod(period)}
                style={{
                  padding: '0.4rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: analyticsPeriod === period ? '#ffffff' : 'transparent',
                  color: analyticsPeriod === period ? '#1f7a4d' : '#64748b',
                  boxShadow: analyticsPeriod === period ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {period === 'week' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>

        {analyticsLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading insights...</div>
        ) : analyticsData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Key Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1.25rem', backgroundColor: '#f0fdf4', borderRadius: '0.75rem', border: '1px solid #dcfce7' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#166534', marginBottom: '0.25rem' }}>
                  {analyticsData.patterns.totalConsumption.toFixed(1)}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Units</div>
              </div>
              <div style={{ padding: '1.25rem', backgroundColor: '#fffbeb', borderRadius: '0.75rem', border: '1px solid #fef3c7' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#b45309', marginBottom: '0.25rem' }}>
                  {analyticsData.wastePredictions?.length || 0}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>At Risk Items</div>
              </div>
            </div>

            {/* Top Categories */}
            <div>
              <h4 style={{ fontSize: '1rem', color: '#475569', marginBottom: '1rem', fontWeight: '600' }}>Top Categories</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(analyticsData.patterns.categoryConsumption)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 5)
                  .map(([category, amount]) => {
                    const percentage = ((amount as number) / analyticsData.patterns.totalConsumption) * 100;
                    return (
                      <div key={category} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '100px', fontSize: '0.85rem', fontWeight: '500', color: '#334155' }}>{category}</div>
                        <div style={{ flex: 1, height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #1f7a4d, #28a745)',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                        <div style={{ width: '50px', textAlign: 'right', fontSize: '0.85rem', fontWeight: '600', color: '#1f7a4d' }}>
                          {percentage.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Insights */}
            {analyticsData.insights?.length > 0 && (
              <div>
                <h4 style={{ fontSize: '1rem', color: '#475569', marginBottom: '1rem', fontWeight: '600' }}>Smart Insights</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {analyticsData.insights.slice(0, 3).map((insight: any, idx: number) => (
                    <div key={idx} style={{
                      padding: '1rem',
                      backgroundColor: insight.type === 'warning' ? '#fff7ed' : '#eff6ff',
                      borderRadius: '0.5rem',
                      borderLeft: `4px solid ${insight.type === 'warning' ? '#f97316' : '#3b82f6'}`
                    }}>
                      <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.5' }}>{insight.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            No data available yet.
          </div>
        )}
      </div>

      {/* Recent Usage History */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Recent History</h3>
        {loading ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Loading history...</p>
        ) : logs.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {logs.map((log) => (
              <div key={log.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                backgroundColor: '#f8fafc',
                borderRadius: '0.75rem',
                border: '1px solid #f1f5f9',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: '#334155', fontSize: '0.95rem', marginBottom: '0.25rem' }}>{log.item_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(log.logged_at).toLocaleDateString()} · {log.category}
                  </div>
                </div>
                <div style={{ fontWeight: '700', color: '#1f7a4d', fontSize: '1rem', marginLeft: '1rem' }}>
                  -{log.quantity} {log.unit}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '3rem' }}>No usage recorded yet.</p>
        )}
      </div>
    </div>
  );
}
