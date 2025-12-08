import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { SummaryCard } from '../components/SummaryCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { DashboardData } from '../types';

export function Dashboard() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await api.getDashboard(token);
        setData(response as DashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token]);

  return (
    <>
      <div className="page-header">
        <div>
          <p style={{ margin: 0 }}>{t('dashboard.welcomeBack', 'Welcome back,')}</p>
          <h2>{user?.full_name ?? t('dashboard.householdOverview', 'Household overview')}</h2>
        </div>
        <button className="primary-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          {t('dashboard.quickActions', 'Quick actions')}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="summary-grid">
        <SummaryCard
          label={t('dashboard.itemsInInventory', 'Items in inventory')}
          value={data?.totals.inventory ?? 0}
          accent="green"
        />
        <SummaryCard label={t('dashboard.expiringSoon', 'Expiring soon')} value={data?.totals.expiringSoon ?? 0} accent="orange" />
        <SummaryCard label={t('dashboard.usageThisWeek', 'Usage this week')} value={data?.totals.recentLogs ?? 0} accent="purple" />
        <SummaryCard label={t('dashboard.householdSize', 'Household size')} value={user?.household_size ?? '—'} accent="blue" />
      </div>

      <div className="card budget-usage-card" style={{ marginBottom: '1.5rem' }}>
        <div className="budget-card-header">
          <h3>{t('dashboard.budgetUtilization', 'Budget utilization')}</h3>
          {data?.budgetUsage?.budgetAmount && (
            <span className="budget-period-chip">Tracking {data.budgetUsage.periodLabel}</span>
          )}
        </div>
        {loading ? (
          <p>{t('common.loading', 'Crunching numbers…')}</p>
        ) : data?.budgetUsage && data.budgetUsage.budgetAmount ? (
          <div className="budget-usage-body">
            {(() => {
              const clampedPercent = Math.min(Math.max(data.budgetUsage.percentage, 0), 100);
              const ringStyle = {
                background: `conic-gradient(var(--green-900) ${clampedPercent}%, rgba(31, 122, 77, 0.1) ${clampedPercent}% 100%)`,
              };
              return (
                <>
                  <div className="budget-ring" style={ringStyle}>
                    <div className="budget-ring__inner">
                      <strong>{Math.round(clampedPercent)}%</strong>
                      <small>{t('common.used', 'used')}</small>
                    </div>
                  </div>
                  <div className="budget-details">
                    <p className="budget-amount">
                      <strong>BDT {data.budgetUsage.used.toFixed(2)}</strong> of{' '}
                      <span>BDT {data.budgetUsage.budgetAmount.toFixed(2)}</span>
                    </p>
                    <p className="budget-remaining">
                      {t('common.remaining', 'Remaining')}: <strong>BDT {data.budgetUsage.remaining.toFixed(2)}</strong>
                    </p>
                    <p className="budget-meta">
                      Tracking since {new Date(data.budgetUsage.since).toLocaleDateString()}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="budget-empty-state">
            <p>
              {t('dashboard.budgetEmptyState', 'Track your food spending and stay within budget. Set a household budget to visualize how inventory purchases impact your limits.')}
            </p>
            <button
              className="primary-btn"
              onClick={() => {
                window.location.hash = '#/profile';
              }}
            >
              {t('dashboard.setBudget', 'Set Budget')}
            </button>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header-with-icon">
            <Package className="card-header-icon" size={24} />
            <h3>{t('dashboard.inventorySnapshot', 'Inventory snapshot')}</h3>
          </div>
          {loading ? (
            <div className="loading-skeleton">
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </div>
          ) : (
            <div className="inventory-snapshot-list">
              {data?.inventoryPreview?.length ? (
                data.inventoryPreview.map((item) => {
                  const isExpiringSoon = item.expires_at && new Date(item.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                  const isExpired = item.expires_at && new Date(item.expires_at) < new Date();

                  return (
                    <div key={item.id} className="snapshot-item">
                      <div className={`snapshot-icon-wrapper ${isExpired ? 'expired' : isExpiringSoon ? 'warning' : 'fresh'}`}>
                        <Package size={16} />
                      </div>
                      <div className="snapshot-details">
                        <span className="snapshot-name" title={item.custom_name || t('common.unnamedItem', 'Unnamed item')}>
                          {item.custom_name || t('common.unnamedItem', 'Unnamed item')}
                        </span>
                        <div className="snapshot-meta">
                          {item.expires_at ? (
                            <span className={`snapshot-date ${isExpired ? 'text-red' : isExpiringSoon ? 'text-orange' : ''}`}>
                              {isExpired
                                ? t('common.expired', 'Expired')
                                : new Date(item.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          ) : (
                            <span className="snapshot-date">--</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state-small">
                  <Package size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p>{t('dashboard.noInventory', 'No inventory yet')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3>{t('dashboard.recentUsage', 'Recent usage')}</h3>
          {loading ? (
            <p>{t('common.loading', 'Loading usage…')}</p>
          ) : data?.recentLogs?.length ? (
            <ul className="compact-list">
              {data.recentLogs.map((log) => (
                <li key={log.id} className="compact-list-item">
                  <span className="log-name">{log.item_name}</span>
                  <span className="log-meta">
                    {log.category} · {new Date(log.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('dashboard.noUsage', 'No usage entries yet.')}</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>{t('dashboard.recommendedResources', 'Recommended resources')}</h3>
        {loading ? (
          <p>{t('common.loading', 'Loading tips…')}</p>
        ) : data?.recommendedResources?.length ? (
          data.recommendedResources.map((resource) => (
            <div key={resource.id} style={{ marginBottom: '1.25rem' }}>
              <strong>{resource.title}</strong>
              <p style={{ margin: '0.2rem 0 0.35rem' }}>{resource.description}</p>
              <div className="resource-chip">{resource.category}</div>
              <div className="resource-chip">{resource.resource_type}</div>
            </div>
          ))
        ) : (
          <p>{t('dashboard.noRecommendations', 'No personalized recommendations yet—record some consumption to get started.')}</p>
        )}
      </div>
    </>
  );
}
