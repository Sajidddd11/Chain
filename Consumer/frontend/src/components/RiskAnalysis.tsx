import { useState, useMemo } from 'react';
import type { InventoryItem } from '../types';
import { AlertTriangle, TrendingDown, Flame, Clock, Package, Activity } from 'lucide-react';

interface SimpleLog {
  item_name: string;
  logged_at: string;
}

interface RiskAnalysisProps {
  items: InventoryItem[];
  logs: SimpleLog[];
}

type RiskLevel = 'High' | 'Medium' | 'Low';

export function RiskAnalysis({ items, logs }: RiskAnalysisProps) {
  const [filterLevel, setFilterLevel] = useState<RiskLevel | 'All'>('All');

  const riskItems = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const isWarmSeason = currentMonth >= 4 && currentMonth <= 8;

    return items.map(item => {
      let score = 0;
      const reasons: string[] = [];

      if (item.expires_at) {
        const expiryDate = new Date(item.expires_at);
        const now = new Date();
        const diffTime = expiryDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          score += 100;
          reasons.push('Expired');
        } else if (diffDays <= 3) {
          score += 90;
          reasons.push('Expires in 3 days');
        } else if (diffDays <= 7) {
          score += 60;
          reasons.push('Expires this week');
        } else if (diffDays <= 14) {
          score += 30;
        }
      } else {
        if (['Vegetable', 'Fruit', 'Dairy', 'Protein'].includes(item.category)) {
          score += 40;
          reasons.push('No expiry date');
        }
      }

      const itemName = (item.custom_name || item.food_item?.name || '').toLowerCase();
      const itemLogs = logs.filter(log => log.item_name.toLowerCase().includes(itemName));
      const consumptionCount = itemLogs.length;

      if (consumptionCount === 0) {
        score += 15;
        reasons.push('Low usage');
      } else if (consumptionCount > 3) {
        score -= 20;
      }

      if (isWarmSeason && ['Fruit', 'Vegetable', 'Dairy'].includes(item.category)) {
        score += 15;
        reasons.push('Heat sensitive');
      }

      if (item.purchased_at) {
        const purchaseDate = new Date(item.purchased_at);
        const ageDays = (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > 30 && ['Pantry', 'Frozen'].includes(item.category)) {
          score += 5;
        } else if (ageDays > 7 && ['Vegetable', 'Fruit'].includes(item.category)) {
          score += 20;
          reasons.push('Old stock');
        }
      }

      score = Math.min(Math.max(score, 0), 100);

      let level: RiskLevel = 'Low';
      if (score >= 70) level = 'High';
      else if (score >= 40) level = 'Medium';

      return { item, score, level, reasons };
    }).sort((a, b) => b.score - a.score);
  }, [items, logs]);

  const filteredItems = filterLevel === 'All' ? riskItems : riskItems.filter(i => i.level === filterLevel);
  const highRiskCount = riskItems.filter(i => i.level === 'High').length;
  const mediumRiskCount = riskItems.filter(i => i.level === 'Medium').length;
  const estimatedWasteValue = riskItems
    .filter(i => i.level === 'High')
    .reduce((sum, i) => sum + (Number(i.item.price) || 0), 0);

  return (
    <div className="risk-analysis-wrapper">
      <div className="risk-stats-grid">
        <div className="stat-card stat-danger">
          <div className="stat-icon">
            <AlertTriangle size={20} strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{highRiskCount}</div>
            <div className="stat-label">High Risk Items</div>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon">
            <TrendingDown size={20} strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{mediumRiskCount}</div>
            <div className="stat-label">Medium Risk Items</div>
          </div>
        </div>

        <div className="stat-card stat-value">
          <div className="stat-icon">
            <Package size={20} strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-value">৳{estimatedWasteValue.toFixed(0)}</div>
            <div className="stat-label">Potential Loss</div>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon">
            <Flame size={20} strokeWidth={2.5} />
          </div>
          <div className="stat-content">
            <div className="stat-value">Warm Season</div>
            <div className="stat-label">Faster Degradation</div>
          </div>
        </div>
      </div>

      <div className="risk-controls">
        <h3 className="section-title">Risk Assessment</h3>
        <div className="filter-group">
          {(['All', 'High', 'Medium', 'Low'] as const).map(level => (
            <button
              key={level}
              className={`filter-btn ${filterLevel === level ? 'active' : ''} ${level !== 'All' ? `filter-${level.toLowerCase()}` : ''}`}
              onClick={() => setFilterLevel(level)}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="risk-grid">
        {filteredItems.map(({ item, score, level, reasons }) => {
          const expiryDate = item.expires_at ? new Date(item.expires_at) : null;
          const daysUntilExpiry = expiryDate
            ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <div key={item.id} className={`risk-card risk-${level.toLowerCase()}`}>
              <div className="risk-card-header">
                <div className="item-category">{item.category}</div>
                <div className={`risk-level level-${level.toLowerCase()}`}>
                  {level}
                </div>
              </div>

              <h4 className="item-title">{item.custom_name || item.food_item?.name || 'Unknown Item'}</h4>

              <div className="item-meta">
                <div className="meta-item">
                  <Clock size={14} />
                  <span>
                    {expiryDate
                      ? daysUntilExpiry !== null && daysUntilExpiry < 0
                        ? 'Expired'
                        : `${daysUntilExpiry}d left`
                      : 'No date'
                    }
                  </span>
                </div>
                <div className="meta-item">
                  <Package size={14} />
                  <span>{item.quantity || 0} {item.unit || 'pcs'}</span>
                </div>
                {item.price && (
                  <div className="meta-item">
                    <span className="price-tag">৳{Number(item.price).toFixed(0)}</span>
                  </div>
                )}
              </div>

              {reasons.length > 0 && (
                <div className="risk-tags">
                  {reasons.slice(0, 3).map((reason, idx) => (
                    <span key={idx} className="risk-tag">{reason}</span>
                  ))}
                </div>
              )}

              <div className="risk-score-bar">
                <div
                  className={`score-fill score-${level.toLowerCase()}`}
                  style={{ width: `${score}%` }}
                />
              </div>

              <div className="risk-score-label">Risk Score: {Math.round(score)}%</div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="empty-state">
            <Activity size={40} strokeWidth={1.5} />
            <p>No items at this risk level</p>
            <span>Your inventory is well managed!</span>
          </div>
        )}
      </div>

      <style>{`
        .risk-analysis-wrapper {
          padding: 0;
        }

        .risk-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: var(--white);
          border-radius: 1.25rem;
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          border: 1px solid rgba(31, 122, 77, 0.1);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: var(--shadow-soft);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(31, 122, 77, 0.2);
        }

        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-danger .stat-icon {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.1) 0%, rgba(31, 122, 77, 0.15) 100%);
          color: var(--green-900);
        }

        .stat-warning .stat-icon {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.08) 0%, rgba(31, 122, 77, 0.12) 100%);
          color: var(--green-900);
        }

        .stat-value .stat-icon {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.1) 0%, rgba(31, 122, 77, 0.15) 100%);
          color: var(--green-900);
        }

        .stat-info .stat-icon {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.08) 0%, rgba(31, 122, 77, 0.12) 100%);
          color: var(--green-900);
        }

        .stat-content {
          flex: 1;
          min-width: 0;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--green-900);
          line-height: 1.2;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-size: 0.8rem;
          color: rgba(0, 0, 0, 0.6);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .risk-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--green-900);
          margin: 0;
        }

        .filter-group {
          display: flex;
          gap: 0.5rem;
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.05) 0%, rgba(31, 122, 77, 0.1) 100%);
          padding: 0.25rem;
          border-radius: 10px;
          border: 1px solid rgba(31, 122, 77, 0.15);
        }

        .filter-btn {
          padding: 0.5rem 1.25rem;
          border: none;
          background: transparent;
          color: rgba(0, 0, 0, 0.6);
          font-weight: 600;
          font-size: 0.875rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          color: var(--black);
        }

        .filter-btn.active {
          background: var(--white);
          color: var(--green-900);
          box-shadow: 0 2px 8px rgba(31, 122, 77, 0.15);
        }

        .filter-btn.filter-high.active {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.15) 0%, rgba(31, 122, 77, 0.2) 100%);
          color: var(--green-900);
        }

        .filter-btn.filter-medium.active {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.1) 0%, rgba(31, 122, 77, 0.15) 100%);
          color: var(--green-900);
        }

        .filter-btn.filter-low.active {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.08) 0%, rgba(31, 122, 77, 0.12) 100%);
          color: var(--green-900);
        }

        .risk-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .risk-card {
          background: linear-gradient(135deg, var(--white) 0%, var(--sage-50) 100%);
          border-radius: 1.25rem;
          padding: 1.25rem;
          border: 2px solid rgba(31, 122, 77, 0.2);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          box-shadow: var(--shadow-soft);
        }

        .risk-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(31, 122, 77, 0.3);
          border-color: rgba(31, 122, 77, 0.4);
        }

        .risk-card.risk-high {
          border-color: rgba(31, 122, 77, 0.4);
          background: linear-gradient(135deg, var(--white) 0%, rgba(31, 122, 77, 0.05) 100%);
          box-shadow: 0 4px 20px rgba(31, 122, 77, 0.15);
        }

        .risk-card.risk-medium {
          border-color: rgba(31, 122, 77, 0.3);
          background: linear-gradient(135deg, var(--white) 0%, rgba(31, 122, 77, 0.03) 100%);
          box-shadow: 0 4px 20px rgba(31, 122, 77, 0.1);
        }

        .risk-card.risk-low {
          border-color: rgba(31, 122, 77, 0.2);
          background: linear-gradient(135deg, var(--white) 0%, rgba(31, 122, 77, 0.02) 100%);
          box-shadow: 0 4px 20px rgba(31, 122, 77, 0.08);
        }

        .risk-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .item-category {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--green-900);
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.1) 0%, rgba(31, 122, 77, 0.2) 100%);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          border: 1px solid rgba(31, 122, 77, 0.25);
          box-shadow: 0 1px 3px rgba(31, 122, 77, 0.1);
        }

        .risk-level {
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.1) 0%, rgba(31, 122, 77, 0.2) 100%);
          color: var(--green-900);
          border: 1px solid rgba(31, 122, 77, 0.3);
        }

        .level-high {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.2) 0%, rgba(31, 122, 77, 0.3) 100%);
          color: var(--green-900);
          border: 1px solid rgba(31, 122, 77, 0.4);
          box-shadow: 0 2px 8px rgba(31, 122, 77, 0.15);
        }

        .level-medium {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.15) 0%, rgba(31, 122, 77, 0.25) 100%);
          color: var(--green-900);
          border: 1px solid rgba(31, 122, 77, 0.35);
        }

        .level-low {
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.1) 0%, rgba(31, 122, 77, 0.2) 100%);
          color: var(--green-900);
          border: 1px solid rgba(31, 122, 77, 0.3);
        }

        .item-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--black);
          margin: 0;
          line-height: 1.3;
        }

        .item-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          font-size: 0.8rem;
          color: rgba(0, 0, 0, 0.6);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .price-tag {
          font-weight: 700;
          color: var(--green-900);
        }

        .risk-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .risk-tag {
          padding: 0.25rem 0.625rem;
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.08) 0%, rgba(31, 122, 77, 0.15) 100%);
          color: var(--green-900);
          font-size: 0.7rem;
          font-weight: 600;
          border-radius: 6px;
          border: 1px solid rgba(31, 122, 77, 0.2);
          box-shadow: 0 1px 3px rgba(31, 122, 77, 0.1);
        }

        .risk-score-bar {
          height: 6px;
          background: linear-gradient(90deg, rgba(31, 122, 77, 0.1) 0%, rgba(31, 122, 77, 0.05) 100%);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 0.25rem;
          border: 1px solid rgba(31, 122, 77, 0.15);
        }

        .score-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .score-fill.score-high {
          background: linear-gradient(90deg, var(--green-900) 0%, #2a9d65 100%);
        }

        .score-fill.score-medium {
          background: linear-gradient(90deg, rgba(31, 122, 77, 0.7) 0%, rgba(31, 122, 77, 0.85) 100%);
        }

        .score-fill.score-low {
          background: linear-gradient(90deg, rgba(31, 122, 77, 0.5) 0%, rgba(31, 122, 77, 0.65) 100%);
        }

        .risk-score-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(0, 0, 0, 0.6);
          text-align: right;
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 4rem 2rem;
          background: linear-gradient(135deg, rgba(31, 122, 77, 0.03) 0%, rgba(31, 122, 77, 0.08) 100%);
          border-radius: 1.25rem;
          border: 2px dashed rgba(31, 122, 77, 0.3);
        }

        .empty-state svg {
          color: var(--green-900);
          opacity: 0.5;
          margin-bottom: 1rem;
        }

        .empty-state p {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--green-900);
          margin: 0 0 0.5rem 0;
        }

        .empty-state span {
          font-size: 0.875rem;
          color: rgba(0, 0, 0, 0.6);
        }

        @media (max-width: 768px) {
          .risk-stats-grid {
            grid-template-columns: 1fr;
          }

          .risk-grid {
            grid-template-columns: 1fr;
          }

          .risk-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-group {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
