import { useState } from 'react';
import { Crown, Check, Star, Zap, Shield, TrendingUp, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';

export function Premium() {
  const { token, user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const monthlyPrice = 49;
  const yearlyPrice = 490;
  const savings = monthlyPrice * 12 - yearlyPrice;

  const handleSubscribe = async () => {
    if (!token) return;
    
    // If user doesn't have a phone number and hasn't entered one yet
    if (!user?.phone && !phoneNumber && !showPhoneInput) {
      setShowPhoneInput(true);
      return;
    }

    if (showPhoneInput && !phoneNumber) {
      showToast('error', 'Please enter your mobile number');
      return;
    }

    setIsSubscribing(true);
    try {
      const response = await api.subscribe(token, phoneNumber || undefined);
      if (response.subscribed) {
        showToast('success', 'Successfully subscribed to Premium!');
        await refreshProfile();
        setShowPhoneInput(false);
      }
    } catch (error: any) {
      showToast('error', error.message || 'Failed to subscribe');
    } finally {
      setIsSubscribing(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'AI Chef Assistant',
      description: 'Unlimited personalized meal planning and recipe optimization',
      free: '5 uses/day',
      premium: 'Unlimited'
    },
    {
      icon: TrendingUp,
      title: 'Advanced Analytics',
      description: 'Detailed reports, trends, and insights about your food habits',
      free: '5 views/day',
      premium: 'Unlimited reports'
    },
    {
      icon: Shield,
      title: 'SMS Notifications',
      description: 'Real-time alerts for expiring food and inventory updates',
      free: '5 messages/day',
      premium: 'Unlimited alerts'
    },
    {
      icon: Star,
      title: 'Premium Marketplace',
      description: 'Advanced buying and selling with priority listings',
      free: '5 interactions/day',
      premium: 'Unlimited transactions'
    },
    {
      icon: Crown,
      title: 'Priority Waste Pickup',
      description: 'Fast-track your waste collection requests',
      free: '5 requests/month',
      premium: 'Unlimited priority pickups'
    },
    {
      icon: Check,
      title: 'Recipe Management',
      description: 'Advanced recipe saving and nutritional analysis',
      free: '5 saves/day',
      premium: 'Unlimited recipes'
    }
  ];

  return (
    <div className="premium-page-container">
      {/* Header */}
      <div className="premium-header">
        <div className="premium-header-title-group">
          <Crown className="premium-header-icon" />
          <h1 className="premium-header-title">Premium Features</h1>
        </div>
        <p className="premium-header-desc">
          Unlock unlimited access to advanced features that help you optimize your food management and reduce waste.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="premium-billing-toggle">
        <span className={`premium-billing-label ${billingCycle === 'monthly' ? 'active' : ''}`}>
          Monthly
        </span>
        <button
          onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
          className={`premium-toggle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
        >
          <span
            className={`premium-toggle-slider ${billingCycle === 'yearly' ? 'active' : ''}`}
          />
        </button>
        <div className="premium-billing-group">
          <span className={`premium-billing-label ${billingCycle === 'yearly' ? 'active' : ''}`}>
            Yearly
          </span>
          {billingCycle === 'yearly' && (
            <span className="premium-save-badge">
              Save ৳{savings}
            </span>
          )}
        </div>
      </div>

      {/* Pricing Card */}
      <div className="premium-pricing-wrapper">
        <div className="premium-pricing-card">
          <div className="premium-plan-header">
            <Crown className="premium-plan-icon" />
            <h2 className="premium-plan-title">Premium Plan</h2>
          </div>

          <div className="premium-price-section">
            <div className="premium-price-display">
              ৳{billingCycle === 'monthly' ? monthlyPrice : Math.round(yearlyPrice / 12)}
              <span className="premium-price-period">
                /{billingCycle === 'monthly' ? 'month' : 'month'}
              </span>
            </div>
            {billingCycle === 'yearly' && (
              <div className="premium-price-subtext">
                Billed annually (৳{yearlyPrice}/year)
              </div>
            )}
          </div>

          {showPhoneInput ? (
            <div className="premium-phone-input-group">
              <input
                type="tel"
                placeholder="Enter mobile number (e.g. 017...)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="premium-phone-input"
              />
              <div className="premium-phone-actions">
                <button 
                  onClick={() => setShowPhoneInput(false)}
                  className="premium-btn-cancel"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="premium-btn-confirm"
                >
                  {isSubscribing ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Confirm'}
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleSubscribe}
              className="premium-upgrade-btn"
            >
              Upgrade to Premium
            </button>
          )}

          <p className="premium-guarantee-text">
            Cancel anytime • 30-day money-back guarantee
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="premium-features-grid">
        {features.map((feature, index) => {
          const IconComponent = feature.icon;
          return (
            <div key={index} className="premium-feature-card">
              <div className="premium-feature-header">
                <div className="premium-feature-icon-wrapper">
                  <IconComponent className="premium-feature-icon" />
                </div>
                <h3 className="premium-feature-title">{feature.title}</h3>
              </div>

              <p className="premium-feature-desc">{feature.description}</p>

              <div className="premium-feature-comparison">
                <div className="premium-comparison-row">
                  <span className="premium-comparison-label">Free Plan:</span>
                  <span className="premium-comparison-value">{feature.free}</span>
                </div>
                <div className="premium-comparison-row">
                  <span className="premium-comparison-label premium">Premium:</span>
                  <span className="premium-comparison-value premium">{feature.premium}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="premium-faq-section">
        <h2 className="premium-faq-title">
          Frequently Asked Questions
        </h2>

        <div className="premium-faq-list">
          <div className="premium-faq-item">
            <h3 className="premium-faq-question">
              Can I cancel my subscription anytime?
            </h3>
            <p className="premium-faq-answer">
              Yes, you can cancel your subscription at any time. You'll continue to have access to premium features until the end of your billing period.
            </p>
          </div>

          <div className="premium-faq-item">
            <h3 className="premium-faq-question">
              What happens to my data if I cancel?
            </h3>
            <p className="premium-faq-answer">
              Your data remains safe and accessible. You'll simply be limited to free tier usage limits until you resubscribe.
            </p>
          </div>

          <div className="premium-faq-item">
            <h3 className="premium-faq-question">
              Is there a free trial?
            </h3>
            <p className="premium-faq-answer">
              You can explore all features with our daily free limits. This gives you a good sense of the premium experience before upgrading.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}