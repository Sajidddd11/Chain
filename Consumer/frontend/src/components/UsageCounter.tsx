import { Lock, Crown } from 'lucide-react';

interface UsageCounterProps {
  feature: string;
  currentUsage: number;
  limit: number | 'unlimited';
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

export function UsageCounter({ 
  feature, 
  currentUsage, 
  limit, 
  isPremium = false,
  onUpgradeClick 
}: UsageCounterProps) {
  const isLocked = !isPremium && typeof limit === 'number' && currentUsage >= limit;
  const remaining = isPremium || limit === 'unlimited' 
    ? 'unlimited' 
    : Math.max(0, limit - currentUsage);

  const getFeatureName = (featureType: string) => {
    const names: Record<string, string> = {
      'ai_chef': 'AI Chef',
      'recipes': 'Recipe Suggestions',
      'analytics': 'Analytics',
      'waste_pickup': 'Waste Pickup',
      'marketplace': 'Marketplace Orders',
      'sms': 'SMS Notifications'
    };
    return names[featureType] || featureType.replace('_', ' ');
  };

  return (
    <div className="usage-counter-container">
      <div className="usage-counter-header">
        <span className="usage-counter-title">
          {getFeatureName(feature)}
        </span>
        {isPremium ? (
          <div className="usage-counter-badge usage-counter-premium">
            <Crown size={14} />
            <span>Premium</span>
          </div>
        ) : isLocked ? (
          <div className="usage-counter-badge usage-counter-locked">
            <Lock size={14} />
            <span>Locked</span>
          </div>
        ) : null}
      </div>
      
      <div className="usage-counter-stats">
        {isPremium || limit === 'unlimited' ? (
          <div className="usage-counter-unlimited">
            <span className="usage-counter-value">∞</span>
            <span className="usage-counter-label">Unlimited</span>
          </div>
        ) : (
          <>
            <div className="usage-counter-progress">
              <div className="usage-counter-bar">
                <div 
                  className={`usage-counter-fill ${isLocked ? 'locked' : ''}`}
                  style={{ width: `${Math.min((currentUsage / limit) * 100, 100)}%` }}
                />
              </div>
              <span className={`usage-counter-text ${isLocked ? 'locked' : ''}`}>
                {currentUsage} / {limit} used today
              </span>
            </div>
            
            {!isLocked && remaining !== 'unlimited' && (
              <span className="usage-counter-remaining">
                {remaining} {remaining === 1 ? 'use' : 'uses'} left
              </span>
            )}
          </>
        )}
      </div>

      {isLocked && onUpgradeClick && (
        <button 
          onClick={onUpgradeClick}
          className="usage-counter-upgrade-btn"
        >
          <Crown size={16} />
          Upgrade to Premium
        </button>
      )}
    </div>
  );
}
