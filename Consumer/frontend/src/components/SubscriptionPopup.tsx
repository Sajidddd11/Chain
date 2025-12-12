import { useState } from 'react';
import { X, Crown, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useToast } from '../components/ToastContext';

interface SubscriptionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  userTier?: string;
  usageStats?: {
    feature: string;
    currentUsage: number;
    limit: number;
    remaining: number;
  }[];
}

export function SubscriptionPopup({
  isOpen,
  onClose,
  onUpgrade,
  userTier = 'free',
  usageStats = []
}: SubscriptionPopupProps) {
  const { token } = useAuth();
  const { showToast } = useToast() || { showToast: () => {} };
  const [view, setView] = useState<'info' | 'input'>('info');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isPremium = userTier === 'premium' || userTier === 'pro';

  const handleSubscribe = async () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }
    // Basic validation for BD number
    if (!/^01\d{9}$/.test(phoneNumber)) {
       setError('Please enter a valid 11-digit mobile number (e.g., 017...)');
       return;
    }

    setLoading(true);
    setError('');
    try {
      if (!token) throw new Error('You must be logged in');
      const response = await api.subscribe(token, phoneNumber);
      if (response.subscribed) {
        showToast('success', 'Successfully subscribed!');
        onClose();
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscription-popup-overlay">
      <div className="subscription-popup-container">
        {/* Header */}
        <div className="subscription-popup-header">
          <div className="subscription-popup-title-group">
            <Crown className="subscription-icon-crown" />
            <h2 className="subscription-popup-title">
              {isPremium ? 'Premium Member' : 'Upgrade to Premium'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="subscription-close-btn"
          >
            <X className="subscription-icon-close" />
          </button>
        </div>

        {/* Content */}
        <div className="subscription-popup-content">
          {!isPremium ? (
            <>
              {view === 'info' ? (
                <>
                  {/* Usage Stats */}
                  {usageStats.length > 0 && (
                    <div className="subscription-section">
                      <h3 className="subscription-section-title">
                        Today's Usage
                      </h3>
                      <div className="subscription-usage-list">
                        {usageStats.map((stat, index) => (
                          <div key={index} className="subscription-usage-item">
                            <span className="subscription-usage-label">
                              {stat.feature.replace('_', ' ')}
                            </span>
                            <span className={`subscription-usage-value ${
                              stat.remaining <= 1 ? 'text-danger' : ''
                            }`}>
                              {stat.currentUsage}/{stat.limit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Premium Benefits */}
                  <div className="subscription-section">
                    <h3 className="subscription-section-title-lg">
                      Premium Benefits
                    </h3>
                    <div className="subscription-benefits-list">
                      <div className="subscription-benefit-item">
                        <Check className="subscription-icon-check" />
                        <div>
                          <p className="subscription-benefit-title">Unlimited AI Chef</p>
                          <p className="subscription-benefit-desc">Get unlimited meal planning assistance</p>
                        </div>
                      </div>
                      <div className="subscription-benefit-item">
                        <Check className="subscription-icon-check" />
                        <div>
                          <p className="subscription-benefit-title">Advanced Analytics</p>
                          <p className="subscription-benefit-desc">Detailed reports and insights</p>
                        </div>
                      </div>
                      <div className="subscription-benefit-item">
                        <Check className="subscription-icon-check" />
                        <div>
                          <p className="subscription-benefit-title">SMS Notifications</p>
                          <p className="subscription-benefit-desc">Unlimited alerts for your food inventory</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="subscription-pricing-card">
                    <div className="subscription-pricing-center">
                      <div className="subscription-price">৳49</div>
                      <div className="subscription-period">per month</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="subscription-section">
                  <h3 className="subscription-section-title-lg">
                    Enter Mobile Number
                  </h3>
                  <p className="subscription-benefit-desc" style={{ marginBottom: '1.5rem' }}>
                    Enter your mobile number to subscribe to Premium features via SMS.
                  </p>
                  
                  <div className="subscription-input-group">
                    <label className="subscription-input-label">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      placeholder="017XXXXXXXX"
                      className="subscription-input"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={loading}
                    />
                    {error && <p className="subscription-error-msg">{error}</p>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="subscription-premium-status">
              <Crown className="subscription-icon-crown-lg" />
              <h3 className="subscription-premium-title">
                Premium Member
              </h3>
              <p className="subscription-premium-desc">
                You have unlimited access to all premium features.
              </p>
              <div className="subscription-badge">
                Active Subscription
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="subscription-popup-footer">
          {view === 'info' ? (
            <>
              <button
                onClick={onClose}
                className="subscription-btn-secondary"
              >
                {isPremium ? 'Close' : 'Maybe Later'}
              </button>
              {!isPremium && (
                <button
                  onClick={() => setView('input')}
                  className="subscription-btn-primary"
                >
                  Upgrade Now
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setView('info')}
                className="subscription-btn-secondary"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleSubscribe}
                className="subscription-btn-primary"
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {loading && <Loader2 className="subscription-loading-spinner" size={18} />}
                Subscribe
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}