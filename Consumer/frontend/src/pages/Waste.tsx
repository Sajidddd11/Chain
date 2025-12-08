import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { WasteItem, WasteRecommendation, AgrisenseStatus, WastePickup } from '../types';
import {
  Leaf,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  BarChart3,
  RefreshCw,
  Sparkles,
  Plus,
  Search,
  Truck,
  Gift,
  Clock3,
} from 'lucide-react';

type WasteFormState = {
  itemName: string;
  category: string;
  quantity: string;
  unit: string;
};

type WasteEstimations = {
  totalWasteGrams: number;
  estimatedMoneyWasted: number;
  weeklyProjection: number;
  monthlyProjection: number;
  topWasteCategories: Array<{
    category: string;
    grams: number;
    value: number;
    count: number;
  }>;
};

type CommunityComparison = {
  comparison: 'below' | 'average' | 'above';
  percentageDiff: number;
  communityAverage: number;
  userAverage: number;
};

type TabType = 'overview' | 'track';

export function Waste() {
  const { token, refreshProfile } = useAuth();
  const [items, setItems] = useState<WasteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<WasteFormState>({
    itemName: '',
    category: '',
    quantity: '',
    unit: '',
  });
  const [analysis, setAnalysis] = useState<WasteRecommendation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New state for estimations
  const [estimations, setEstimations] = useState<WasteEstimations | null>(null);
  const [communityComparison, setCommunityComparison] = useState<CommunityComparison | null>(null);
  const [estimationsLoading, setEstimationsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [agrisenseStatus, setAgrisenseStatus] = useState<AgrisenseStatus | null>(null);
  const [agrisenseLoading, setAgrisenseLoading] = useState(false);
  const [agrisenseToggling, setAgrisenseToggling] = useState(false);
  const [agrisenseError, setAgrisenseError] = useState<string | null>(null);
  const [agrisenseSuccess, setAgrisenseSuccess] = useState<string | null>(null);
  const [pickups, setPickups] = useState<WastePickup[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupSubmitting, setPickupSubmitting] = useState(false);
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [pickupSuccess, setPickupSuccess] = useState<string | null>(null);

  const loadWasteItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getWasteItems(token);
      setItems(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load waste insights');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadWasteEstimations = useCallback(async () => {
    if (!token) return;
    setEstimationsLoading(true);
    try {
      const response = await api.getWasteEstimations(token);
      setEstimations(response.estimations);
      setCommunityComparison(response.communityComparison);
    } catch (err) {
      console.error('Failed to load waste estimations:', err);
    } finally {
      setEstimationsLoading(false);
    }
  }, [token]);

  const loadAgrisenseStatus = useCallback(async () => {
    if (!token) return;
    setAgrisenseLoading(true);
    setAgrisenseError(null);
    try {
      const response = await api.getAgrisenseStatus(token);
      setAgrisenseStatus(response.status);
    } catch (err) {
      console.error('Failed to load Agrisense status:', err);
      setAgrisenseError(err instanceof Error ? err.message : 'Failed to load Agrisense status');
    } finally {
      setAgrisenseLoading(false);
    }
  }, [token]);

  const loadPickups = useCallback(async () => {
    if (!token) return;
    setPickupLoading(true);
    setPickupError(null);
    try {
      const response = await api.listWastePickups(token);
      setPickups(response.pickups || []);
    } catch (err) {
      console.error('Failed to load waste pickups:', err);
      setPickupError(err instanceof Error ? err.message : 'Failed to load pickup timeline');
    } finally {
      setPickupLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadWasteItems();
    loadWasteEstimations();
    loadAgrisenseStatus();
    loadPickups();
  }, [loadWasteItems, loadWasteEstimations, loadAgrisenseStatus, loadPickups]);

  const handleAgrisenseToggle = async () => {
    if (!token || !agrisenseStatus) return;

    const nextEnabled = !agrisenseStatus.enabled;

    setAgrisenseToggling(true);
    setAgrisenseError(null);
    setAgrisenseSuccess(null);
    try {
      const response = await api.toggleAgrisense(token, nextEnabled);
      setAgrisenseStatus(response.status);
      setAgrisenseSuccess(response.message);
    } catch (err) {
      setAgrisenseError(
        err instanceof Error ? err.message : 'Failed to update Agrisense integration',
      );
    } finally {
      setAgrisenseToggling(false);
    }
  };

  const handlePickupRequest = async () => {
    if (!token) return;

    setPickupSubmitting(true);
    setPickupError(null);
    setPickupSuccess(null);

    try {
      const response = await api.requestWastePickup(token);
      setPickupSuccess(`Pickup scheduled! +${response.rewardPoints} reward points`);
      await Promise.all([
        loadWasteItems(),
        loadWasteEstimations(),
        loadPickups(),
        refreshProfile(),
      ]);
    } catch (err) {
      setPickupError(err instanceof Error ? err.message : 'Failed to request pickup');
    } finally {
      setPickupSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const cleanName = form.itemName.trim();
    if (!cleanName) {
      setError('Please provide the food or material that was used.');
      return;
    }

    const numericQuantity =
      form.quantity && !Number.isNaN(Number(form.quantity)) ? Number(form.quantity) : null;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.analyzeWaste(token, {
        itemName: cleanName,
        category: form.category.trim() || undefined,
        quantity: numericQuantity ?? undefined,
        unit: form.unit.trim() || undefined,
      });
      setAnalysis(response.recommendations || []);
      setItems(response.items || []);
      setSuccess('Agricultural waste inventory updated.');
      setForm((prev) => ({
        ...prev,
        itemName: '',
        quantity: '',
      }));
      // Reload estimations after adding new waste
      loadWasteEstimations();
      // Clear SDG cache as waste reduction affects SDG score
      api.clearSDGCache(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze waste potential');
    } finally {
      setSubmitting(false);
    }
  };

  const totalTracked = useMemo(
    () =>
      items.reduce<Record<string, number>>((acc, item) => {
        const unit = item.quantity_unit || 'units';
        const value = Number(item.quantity_value ?? 0);
        acc[unit] = (acc[unit] || 0) + value;
        return acc;
      }, {}),
    [items],
  );

  const getComparisonColor = (comparison: string) => {
    if (comparison === 'below') return '#10b981';
    if (comparison === 'above') return '#ef4444';
    return '#f59e0b';
  };

  const getComparisonIcon = (comparison: string) => {
    if (comparison === 'below') return TrendingDown;
    if (comparison === 'above') return TrendingUp;
    return BarChart3;
  };

  const getComparisonMessage = (comparison: string, percentageDiff: number) => {
    if (comparison === 'below') {
      return `${percentageDiff}% below average`;
    }
    if (comparison === 'above') {
      return `${percentageDiff}% above average`;
    }
    return 'On par with average';
  };

  const filteredItems = items.filter((item) =>
    (item.material_name || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const pickupStatusTheme = (status: string) => {
    if (status === 'completed') return 'success';
    if (status === 'scheduled') return 'info';
    if (status === 'cancelled') return 'danger';
    return 'warning';
  };

  const pickupStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Pickup completed';
      case 'scheduled':
        return 'Pickup scheduled';
      case 'cancelled':
        return 'Pickup cancelled';
      default:
        return 'Pickup pending';
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Not updated yet';
    return new Date(value).toLocaleString();
  };

  const latestPickup = pickups[0] ?? null;
  const hasPendingPickup = pickups.some(
    (pickup) => pickup.status === 'pending' || pickup.status === 'scheduled',
  );
  const hasWaste = items.length > 0;
  const pickupButtonDisabled =
    pickupSubmitting || pickupLoading || hasPendingPickup || !hasWaste;
  const pickupButtonText = hasPendingPickup
    ? 'Pickup Pending'
    : hasWaste
      ? 'Request Waste Pickup'
      : 'No Waste Available';
  const pickupTimeline = pickups.slice(0, 3);
  const latestPickupWeightKg =
    latestPickup?.total_weight_grams !== undefined && latestPickup?.total_weight_grams !== null
      ? (Number(latestPickup.total_weight_grams) / 1000).toFixed(2)
      : null;
  const latestPickupReward = latestPickup?.reward_points ?? 0;
  const pickupStatus = latestPickup?.status || 'pending';
  const pickupStatusText = pickupStatusLabel(pickupStatus);
  const pickupStatusTone = pickupStatusTheme(pickupStatus);
  const pickupLastUpdated =
    latestPickup?.updated_at || latestPickup?.requested_at
      ? formatDateTime(latestPickup.updated_at || latestPickup.requested_at)
      : 'Awaiting first pickup';

  const agrisenseStatusLabel = agrisenseLoading
    ? 'Checking Agrisense…'
    : agrisenseStatus
      ? agrisenseStatus.enabled
        ? 'Synced with Agrisense'
        : 'Not linked yet'
      : 'Status unavailable';
  const agrisenseLastSync =
    agrisenseStatus?.lastSyncedAt && !Number.isNaN(Date.parse(agrisenseStatus.lastSyncedAt))
      ? new Date(agrisenseStatus.lastSyncedAt).toLocaleString()
      : 'Not yet synced';
  const agrisenseToggleDisabled =
    agrisenseLoading || agrisenseToggling || !agrisenseStatus || !agrisenseStatus.phone;
  const agrisenseButtonText =
    agrisenseStatus?.enabled && agrisenseStatus.phone
      ? 'Disable sharing'
      : 'Enable & sync';
  const agrisenseButtonTitle =
    !agrisenseStatus?.phone && !agrisenseLoading
      ? 'Add your phone number in Profile to link Agrisense'
      : undefined;

  return (
    <div className="waste-lab-page">
      <div className="page-header-modern">
        <div>
          <h2>Waste Lab</h2>
          <p className="subtitle">AI-powered waste tracking with smart projections and insights</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="refresh-btn-icon"
            onClick={() => {
              loadWasteItems();
              loadWasteEstimations();
            }}
            disabled={loading || estimationsLoading}
            title="Refresh Data"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      <div className="agrisense-card">
        <div className="agrisense-card-header">
          <div className="agrisense-card-copy">
            <div className="agrisense-title-row">
              <Sparkles size={18} />
              <div>
                <h3>Interested in farming?</h3>
                <p className="agrisense-subtitle">
                  Link your Agrisense farmer account to share waste data for compost, feed, and soil regeneration.
                </p>
              </div>
            </div>
            <span
              className={`agrisense-status-pill${
                agrisenseStatus?.enabled ? ' active' : ''
              }`}
            >
              {agrisenseStatusLabel}
            </span>
            {!agrisenseLoading && !agrisenseStatus?.phone && (
              <p className="agrisense-warning">
                Add a phone number in your profile so Agrisense can verify your household.
              </p>
            )}
            {agrisenseStatus?.statusNote && (
              <p className="agrisense-note">{agrisenseStatus.statusNote}</p>
            )}
            {agrisenseError && <p className="error-text agrisense-feedback">{agrisenseError}</p>}
            {agrisenseSuccess && (
              <p className="success-text agrisense-feedback">{agrisenseSuccess}</p>
            )}
          </div>
          <button
            type="button"
            className={`agrisense-toggle-btn${
              agrisenseStatus?.enabled ? ' outline' : ''
            }`}
            onClick={handleAgrisenseToggle}
            disabled={agrisenseToggleDisabled}
            title={agrisenseButtonTitle}
          >
            {agrisenseToggling ? 'Syncing…' : agrisenseButtonText}
          </button>
        </div>

        <div className="agrisense-meta-row">
          <div className="agrisense-meta-item">
            <span className="meta-label">Linked phone</span>
            <span className="meta-value">{agrisenseStatus?.phone || 'Not provided'}</span>
          </div>
          <div className="agrisense-meta-item">
            <span className="meta-label">Waste shared</span>
            <span className="meta-value">
              {agrisenseStatus?.remoteWasteCount ?? 0} items
            </span>
          </div>
          <div className="agrisense-meta-item">
            <span className="meta-label">Last Agrisense sync</span>
            <span className="meta-value">{agrisenseLastSync}</span>
          </div>
        </div>
      </div>

      <div className="pickup-card">
        <div className="pickup-card-header">
          <div className="pickup-card-title">
            <Truck size={20} />
            <div>
              <h3>Request Waste Pickup</h3>
              <p>Send your reusable waste to our Waste Lab partners and reset your inventory.</p>
            </div>
          </div>
          <button
            type="button"
            className="pickup-btn"
            onClick={handlePickupRequest}
            disabled={pickupButtonDisabled}
          >
            {pickupSubmitting ? 'Scheduling…' : pickupButtonText}
          </button>
        </div>

        <div className={`pickup-status-pill ${pickupStatusTone}`}>
          <Clock3 size={18} />
          <div>
            <strong>{pickupStatusText}</strong>
            <span>{pickupLastUpdated}</span>
          </div>
        </div>

        {!hasWaste && !loading && (
          <p className="pickup-note">
            Track some usage in Waste Lab so we can bag materials for pickup.
          </p>
        )}

        <div className="pickup-metrics-grid">
          <div className="pickup-metric">
            <span className="metric-label">Latest pickup weight</span>
            <strong>{latestPickupWeightKg ? `${latestPickupWeightKg} kg` : '—'}</strong>
          </div>
          <div className="pickup-metric">
            <span className="metric-label">Materials cleared</span>
            <strong>{latestPickup?.total_items ?? 0}</strong>
          </div>
          <div className="pickup-metric reward">
            <Gift size={18} />
            <div>
              <span className="metric-label">Reward points earned</span>
              <strong>+{latestPickupReward}</strong>
            </div>
          </div>
        </div>

        {pickupTimeline.length > 0 && (
          <div className="pickup-timeline">
            {pickupTimeline.map((pickup) => (
              <div key={pickup.id} className="pickup-timeline-row">
                <div>
                  <p className="timeline-title">{pickupStatusLabel(pickup.status)}</p>
                  <span className="timeline-subtitle">
                    {formatDateTime(pickup.requested_at)} · {pickup.waste_snapshot?.length || 0} items
                  </span>
                </div>
                <span className={`pickup-status-tag ${pickupStatusTheme(pickup.status)}`}>
                  {pickupStatusLabel(pickup.status)}
                </span>
              </div>
            ))}
          </div>
        )}

        {pickupLoading && <p className="pickup-note">Updating pickup status…</p>}
        {pickupError && <p className="error-text">{pickupError}</p>}
        {pickupSuccess && <p className="success-text">{pickupSuccess}</p>}
      </div>

      {/* Stats Overview */}
      {estimations && estimations.totalWasteGrams > 0 && (
        <div className="stats-overview-grid">
          <div className="stat-card-modern primary">
            <div className="stat-icon">
              <Leaf size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Waste Tracked</div>
              <div className="stat-value">{(estimations.totalWasteGrams / 1000).toFixed(2)} kg</div>
            </div>
          </div>

          <div className="stat-card-modern success">
            <div className="stat-icon">
              <DollarSign size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Estimated Value</div>
              <div className="stat-value">৳{estimations.estimatedMoneyWasted}</div>
            </div>
          </div>

          <div className="stat-card-modern info">
            <div className="stat-icon">
              <Calendar size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Weekly Projection</div>
              <div className="stat-value">{(estimations.weeklyProjection / 1000).toFixed(2)} kg</div>
            </div>
          </div>

          <div className="stat-card-modern warning">
            <div className="stat-icon">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Monthly Projection</div>
              <div className="stat-value">{(estimations.monthlyProjection / 1000).toFixed(2)} kg</div>
            </div>
          </div>
        </div>
      )}

      {/* Community Comparison */}
      {communityComparison && estimations && estimations.totalWasteGrams > 0 && (
        <div className="community-comparison-modern">
          <div className="comparison-header">
            <div className="comparison-title">
              <Users size={20} />
              <h3>Community Comparison</h3>
            </div>
            <div
              className="comparison-badge-modern"
              style={{
                backgroundColor: getComparisonColor(communityComparison.comparison),
              }}
            >
              {(() => {
                const Icon = getComparisonIcon(communityComparison.comparison);
                return <Icon size={16} />;
              })()}
              <span>
                {getComparisonMessage(
                  communityComparison.comparison,
                  communityComparison.percentageDiff,
                )}
              </span>
            </div>
          </div>
          <div className="comparison-stats-row">
            <div className="comparison-stat-item">
              <div className="stat-label-small">Your Average</div>
              <div className="stat-value-large">{communityComparison.userAverage.toFixed(0)} g</div>
            </div>
            <div className="comparison-divider"></div>
            <div className="comparison-stat-item">
              <div className="stat-label-small">Community Average</div>
              <div className="stat-value-large">{communityComparison.communityAverage.toFixed(0)} g</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="inventory-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={18} className="mr-2" /> Waste Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'track' ? 'active' : ''}`}
          onClick={() => setActiveTab('track')}
        >
          <Plus size={18} className="mr-2" /> Track New Usage
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="waste-overview-view animate-fade-in">
            {/* Top Categories */}
            {estimations && estimations.topWasteCategories.length > 0 && (
              <div className="top-categories-section">
                <h3 className="section-title">
                  <Sparkles size={20} />
                  Top Waste Categories
                </h3>
                <div className="category-cards-grid">
                  {estimations.topWasteCategories.map((cat) => (
                    <div key={cat.category} className="category-card-modern">
                      <div className="category-header">
                        <h4>{cat.category}</h4>
                        <span className="category-count">{cat.count} items</span>
                      </div>
                      <div className="category-stats">
                        <div className="category-stat">
                          <span className="stat-label">Weight</span>
                          <span className="stat-value">{cat.grams}g</span>
                        </div>
                        <div className="category-stat">
                          <span className="stat-label">Value</span>
                          <span className="stat-value">৳{cat.value}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Waste Items List */}
            <div className="waste-items-section">
              <div className="section-header-with-search">
                <h3 className="section-title">
                  <Leaf size={20} />
                  Reusable Waste Inventory
                </h3>
                <div className="search-wrapper-compact">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search waste items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="modern-input search-input-compact"
                  />
                </div>
              </div>

              {loading ? (
                <div className="loading-state-modern">
                  <div className="spinner-modern"></div>
                  <p>Loading waste data…</p>
                </div>
              ) : filteredItems.length > 0 ? (
                <>
                  <p className="inventory-summary">
                    Tracked materials by AI.{' '}
                    {Object.keys(totalTracked).length
                      ? `Totals: ${Object.entries(totalTracked)
                        .map(([unit, value]) => `${value.toFixed(2)} ${unit}`)
                        .join(', ')}`
                      : null}
                  </p>
                  <div className="waste-items-grid">
                    {filteredItems.map((item) => (
                      <div key={item.id} className="waste-card-integrated">
                        <div className="waste-card-header">
                          <h4 className="waste-item-name">{item.material_name}</h4>
                          <span className="waste-quantity-badge">
                            {item.quantity_value ?? 0} {item.quantity_unit || 'units'}
                          </span>
                        </div>

                        <div className="waste-card-body">
                          <div className="waste-meta-row">
                            <div className="waste-meta-item">
                              <span className="meta-label">Source</span>
                              <span className="meta-value">{item.source_item_name || 'Unknown'}</span>
                            </div>
                            {item.source_category && (
                              <div className="waste-meta-item">
                                <span className="meta-label">Category</span>
                                <span className="meta-value">{item.source_category}</span>
                              </div>
                            )}
                          </div>

                          {item.last_source_quantity && (
                            <div className="waste-insight-box">
                              <Sparkles size={14} />
                              <span>Generated from {item.last_source_quantity} units of source material</span>
                            </div>
                          )}

                          <div className="waste-timestamp">
                            Updated {item.updated_at ? new Date(item.updated_at).toLocaleString() : '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state-modern">
                  <Leaf size={48} className="empty-icon" />
                  <h4>No Waste Data Yet</h4>
                  <p>Start tracking your usage to see AI-powered waste insights</p>
                  <button className="primary-btn" onClick={() => setActiveTab('track')}>
                    <Plus size={18} />
                    Track New Usage
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'track' && (
          <div className="track-usage-view animate-fade-in">
            <div className="track-form-card">
              <h3>Track New Usage</h3>
              <p className="form-description">
                Describe what was consumed. Our AI will predict reusable agricultural waste and update
                your inventory automatically.
              </p>

              <form onSubmit={handleSubmit} className="form-grid">
                <label htmlFor="waste-item-name">
                  Food or ingredient name *
                  <input
                    id="waste-item-name"
                    type="text"
                    placeholder="e.g., Chicken eggs"
                    value={form.itemName}
                    onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))}
                    required
                  />
                </label>

                <label htmlFor="waste-category">
                  Category
                  <input
                    id="waste-category"
                    type="text"
                    placeholder="Protein, produce, oil…"
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  />
                </label>

                <label htmlFor="waste-quantity">
                  Quantity
                  <input
                    id="waste-quantity"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="4"
                    value={form.quantity}
                    onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  />
                </label>

                <label htmlFor="waste-unit">
                  Unit
                  <input
                    id="waste-unit"
                    type="text"
                    placeholder="pcs, g, ml"
                    value={form.unit}
                    onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                  />
                </label>

                {error && <p className="error-text">{error}</p>}
                {success && <p className="success-text">{success}</p>}

                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Analyzing…' : 'Predict Waste Potential'}
                </button>
              </form>

              {analysis.length > 0 && (
                <div className="ai-predictions-box">
                  <div className="predictions-header">
                    <Sparkles size={18} />
                    <strong>Latest AI Predictions</strong>
                  </div>
                  <div className="predictions-list">
                    {analysis.map((item) => (
                      <div key={`${item.name}-${item.action}`} className="prediction-item">
                        <span className="prediction-action">{item.action}</span>
                        <span className="prediction-details">
                          {item.name} · {item.quantity_value}{' '}
                          {item.quantity_unit ? item.quantity_unit : 'units'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Waste;
