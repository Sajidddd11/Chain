import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';

function PaymentMethodSelector({ selectedMethod, onSelect }: { 
  selectedMethod: string, 
  onSelect: (method: string) => void 
}) {
  const paymentMethods = [
    {
      id: 'cash_on_delivery',
      name: 'Cash on Delivery',
      icon: '💰',
      description: 'Pay when you receive'
    },
    {
      id: 'bkash',
      name: 'bKash',
      icon: '🟣',
      description: 'Mobile banking'
    },
    {
      id: 'nagad',
      name: 'Nagad',
      icon: '🟠',
      description: 'Digital wallet'
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: '💳',
      description: 'Visa, Mastercard, etc.'
    },
    {
      id: 'kutta_pay',
      name: 'Kutta Pay',
      icon: '🟡',
      description: 'Quick payments'
    }
  ];

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '600' }}>
        Payment Method
      </label>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            onClick={() => onSelect(method.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1rem',
              border: `2px solid ${selectedMethod === method.id ? '#1f7a4d' : '#e1e5e9'}`,
              borderRadius: '8px',
              backgroundColor: selectedMethod === method.id ? '#f0fdf4' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ 
              fontSize: '1.5rem', 
              marginRight: '1rem',
              width: '40px',
              textAlign: 'center'
            }}>
              {method.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                {method.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {method.description}
              </div>
            </div>
            <div style={{ 
              width: '20px', 
              height: '20px', 
              borderRadius: '50%', 
              border: `2px solid ${selectedMethod === method.id ? '#1f7a4d' : '#d1d5db'}`,
              backgroundColor: selectedMethod === method.id ? '#1f7a4d' : 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {selectedMethod === method.id && (
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: 'white' 
                }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Checkout() {
  const { token, user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rewardApplied, setRewardApplied] = useState(false);
  const [rewardPointsToUse, setRewardPointsToUse] = useState(0);
  const [rewardDiscount, setRewardDiscount] = useState(0);

  const [deliveryForm, setDeliveryForm] = useState({
    delivery_name: '',
    delivery_phone: '',
    delivery_address: '',
    payment_method: 'cash_on_delivery'
  });

  useEffect(() => {
    loadCart();
  }, [token]);

  const loadCart = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setCart(data);
      
      if (!data.cart_items || data.cart_items.length === 0) {
        showToast('error', 'Your cart is empty');
        window.location.href = '/store';
      }
    } catch (error) {
      showToast('error', 'Failed to load cart');
      window.location.href = '/store';
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodSelect = (method: string) => {
    setDeliveryForm({ ...deliveryForm, payment_method: method });
  };

  const handlePlaceOrder = async () => {
    // No validation required - place order immediately
    setSubmitting(true);

    try {
      // Simulate payment processing delay for non-cash methods
      if (deliveryForm.payment_method !== 'cash_on_delivery') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced delay
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...deliveryForm,
          reward_points_used: rewardApplied ? rewardPointsToUse : 0
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to place order');
      }

      const paymentMethodName = {
        'cash_on_delivery': 'Cash on Delivery',
        'bkash': 'bKash',
        'nagad': 'Nagad',
        'card': 'Card',
        'kutta_pay': 'Kutta Pay'
      }[deliveryForm.payment_method] || deliveryForm.payment_method;

      showToast('success', `Order placed successfully with ${paymentMethodName}!`);
      await refreshProfile();
      window.location.href = '/orders';
    } catch (error: any) {
      showToast('error', error?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const subtotal =
    cart?.cart_items?.reduce((sum: number, item: any) => sum + parseFloat(item.products.price) * item.quantity, 0) || 0;
  const totalAfterDiscount = Math.max(0, subtotal - rewardDiscount);

  const calculateRewardPlan = () => {
    const availablePoints = user?.reward_points ?? 0;
    if (availablePoints <= 0 || subtotal <= 0) {
      return { points: 0, discount: 0 };
    }
    const maxPointsForTotal = Math.floor(subtotal * 20);
    const pointsToUse = Math.min(availablePoints, maxPointsForTotal);
    const discount = Number((pointsToUse / 20).toFixed(2));
    return { points: pointsToUse, discount };
  };

  const handleRewardToggle = () => {
    if (rewardApplied) {
      setRewardApplied(false);
      setRewardPointsToUse(0);
      setRewardDiscount(0);
      return;
    }
    const { points, discount } = calculateRewardPlan();
    if (points <= 0 || discount <= 0) {
      showToast('info', 'You need more reward points to apply a discount.');
      return;
    }
    setRewardApplied(true);
    setRewardPointsToUse(points);
    setRewardDiscount(discount);
  };

  useEffect(() => {
    if (!rewardApplied) return;
    const { points, discount } = calculateRewardPlan();
    if (points <= 0 || discount <= 0) {
      setRewardApplied(false);
      setRewardPointsToUse(0);
      setRewardDiscount(0);
      return;
    }
    setRewardPointsToUse(points);
    setRewardDiscount(discount);
  }, [cart, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="page-header"><h2>Loading...</h2></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Checkout</h2>
        <span>Complete your order</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem', alignItems: 'start' }}>
        {/* Delivery Form */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Delivery Information</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Full Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={deliveryForm.delivery_name}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={deliveryForm.delivery_phone}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_phone: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Delivery Address (Optional)
              </label>
              <textarea
                placeholder="Enter your full delivery address"
                value={deliveryForm.delivery_address}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_address: e.target.value })}
                rows={4}
              />
            </div>

            <PaymentMethodSelector 
              selectedMethod={deliveryForm.payment_method}
              onSelect={handlePaymentMethodSelect}
            />

            <button
              type="button"
              className="primary-btn"
              disabled={submitting}
              onClick={handlePlaceOrder}
              style={{ marginTop: '1rem' }}
            >
              {submitting ? 'Placing Order...' : `Place Order - BDT ${totalAfterDiscount.toFixed(2)}`}
            </button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="card" style={{ position: 'sticky', top: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Order Summary</h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            {cart?.cart_items?.map((item: any) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  marginBottom: '0.5rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600' }}>{item.products.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    BDT {parseFloat(item.products.price).toFixed(2)} × {item.quantity}
                  </div>
                </div>
                <div style={{ fontWeight: '600' }}>
                  BDT {(parseFloat(item.products.price) * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '2px solid rgba(31,122,77,0.1)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Subtotal:</span>
              <span>BDT {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Delivery Fee:</span>
              <span>BDT 0.00</span>
            </div>
            {rewardApplied && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#16a34a' }}>
                <span>Reward Discount ({rewardPointsToUse} pts)</span>
                <span>- BDT {rewardDiscount.toFixed(2)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(31,122,77,0.1)',
                fontSize: '1.2rem',
                fontWeight: 'bold'
              }}
            >
              <span>Total:</span>
              <span style={{ color: '#1f7a4d' }}>
                BDT {totalAfterDiscount.toFixed(2)}
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px dashed rgba(31,122,77,0.25)',
              backgroundColor: rewardApplied ? '#ecfdf5' : '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Use reward points</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                  20 points = 1 BDT · Available: {user?.reward_points ?? 0} pts
                </p>
              </div>
              <label
                style={{
                  position: 'relative',
                  width: '48px',
                  height: '26px',
                  borderRadius: '999px',
                  background: rewardApplied ? '#16a34a' : '#cbd5f5',
                  transition: 'background 0.2s ease',
                  cursor: (user?.reward_points ?? 0) <= 0 || subtotal <= 0 ? 'not-allowed' : 'pointer',
                  opacity: (user?.reward_points ?? 0) <= 0 || subtotal <= 0 ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={rewardApplied}
                  onChange={handleRewardToggle}
                  disabled={(user?.reward_points ?? 0) <= 0 || subtotal <= 0}
                  style={{ display: 'none' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: rewardApplied ? '24px' : '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s ease',
                  }}
                />
              </label>
            </div>
            {rewardApplied && (
              <p style={{ margin: '0.5rem 0 0', color: '#16a34a', fontSize: '0.9rem' }}>
                Using {rewardPointsToUse} pts (-৳{rewardDiscount.toFixed(2)})
              </p>
            )}
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: '#d1fae5',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#059669'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              Free Delivery
            </div>
            <div>
              Enjoy free delivery on all orders!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
