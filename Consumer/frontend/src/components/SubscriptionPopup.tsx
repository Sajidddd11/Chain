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
  const { showToast } = useToast() || { showToast: () => { } };
  const [view, setView] = useState<'info' | 'input' | 'otp'>('info');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isPremium = userTier === 'premium' || userTier === 'pro';

  const handleRequestOTP = async () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }
    // Basic validation for BD number
    if (!/^01\d{9}$/.test(phoneNumber)) {
      setError('Please enter a valid 11-digit mobile number (e.g., 017...)');
      return;
    }

    // Check if Banglalink number
    if (!phoneNumber.match(/^(017|013|019)/)) {
      setError('Premium subscription via carrier billing is only available for Banglalink numbers (017, 013, 019).');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (!token) throw new Error('You must be logged in');

      // First, update user's phone number
      await api.updateProfile(token, { phone: phoneNumber });

      // Then request OTP for charging
      const response = await api.requestPremiumOTP(token);

      if (response.success) {
        setReferenceNo(response.referenceNo);
        setView('otp');
        showToast('success', 'OTP sent to your mobile number!');
      } else {
        setError(response.message || 'Failed to request OTP');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to request OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }

    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (!token) throw new Error('You must be logged in');
      const response = await api.verifyPremiumOTP(token, otp, referenceNo);

      if (response.success) {
        showToast('success', 'Payment successful! Welcome to Premium!');
        onClose();
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setError(response.message || 'Invalid OTP');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to verify OTP. Please try again.');
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
                            <span className={`subscription-usage-value ${stat.remaining <= 1 ? 'text-danger' : ''
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
              ) : view === 'input' ? (
                <div className="subscription-section">
                  <h3 className="subscription-section-title-lg">
                    Enter Mobile Number
                  </h3>
                  <p className="subscription-benefit-desc" style={{ marginBottom: '1.5rem' }}>
                    Enter your Banglalink number. We'll send an OTP to verify and charge ৳49 from your mobile balance.
                  </p>

                  <div className="subscription-input-group">
                    <label className="subscription-input-label">
                      Mobile Number (Banglalink only)
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
              ) : (
                <div className="subscription-section">
                  <h3 className="subscription-section-title-lg">
                    Enter OTP
                  </h3>
                  <p className="subscription-benefit-desc" style={{ marginBottom: '1.5rem' }}>
                    We've sent a 6-digit OTP to your mobile number. Enter it below to complete payment.
                  </p>

                  <div className="subscription-input-group">
                    <label className="subscription-input-label">
                      OTP Code
                    </label>
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="subscription-input"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      disabled={loading}
                      style={{ letterSpacing: '0.5em', fontSize: '1.5rem', textAlign: 'center' }}
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
          ) : view === 'input' ? (
            <>
              <button
                onClick={() => { setView('info'); setError(''); }}
                className="subscription-btn-secondary"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleRequestOTP}
                className="subscription-btn-primary"
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {loading && <Loader2 className="subscription-loading-spinner" size={18} />}
                Request OTP
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setView('input'); setError(''); setOtp(''); }}
                className="subscription-btn-secondary"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleVerifyOTP}
                className="subscription-btn-primary"
                disabled={loading || otp.length !== 6}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {loading && <Loader2 className="subscription-loading-spinner" size={18} />}
                Verify & Subscribe
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}