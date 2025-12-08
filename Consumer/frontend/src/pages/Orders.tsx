import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';

export function Orders() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    loadOrders();
    
    // Set up polling for real-time updates every 30 seconds
    const interval = setInterval(() => {
      loadOrders(true); // Silent refresh
    }, 30000);
    
    // Refresh when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadOrders(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      if (!silent) showToast('error', 'Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
      if (silent) setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#fef3c7', text: '#d97706' },
      processing: { bg: '#dbeafe', text: '#2563eb' },
      shipped: { bg: '#e0e7ff', text: '#6366f1' },
      delivered: { bg: '#d1fae5', text: '#059669' },
      cancelled: { bg: '#fee2e2', text: '#dc2626' }
    };
    return colors[status] || colors.pending;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Orders</h2>
          <span>Track your order history {refreshing && '(updating...)'}</span>
        </div>
        <button 
          className="secondary-btn" 
          onClick={() => loadOrders(false)}
          disabled={loading || refreshing}
          style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="card">
          <p>Loading your orders...</p>
        </div>
      ) : orders.length > 0 ? (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {orders.map(order => {
            const statusColor = getStatusColor(order.status);
            return (
              <div
                key={order.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      Order #{order.id.substring(0, 8)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1f7a4d', marginBottom: '0.5rem' }}>
                      BDT {parseFloat(order.total_amount).toFixed(2)}
                    </div>
                    <span
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        backgroundColor: statusColor.bg,
                        color: statusColor.text,
                        textTransform: 'capitalize'
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>

                {selectedOrder?.id === order.id && (
                  <div
                    style={{
                      marginTop: '1.5rem',
                      paddingTop: '1.5rem',
                      borderTop: '2px solid rgba(31,122,77,0.1)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ marginBottom: '0.75rem' }}>Delivery Information</h4>
                      <div
                        style={{
                          backgroundColor: '#f8f9fa',
                          padding: '1rem',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      >
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Name:</strong> {order.delivery_name}
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Phone:</strong> {order.delivery_phone}
                        </div>
                        <div>
                          <strong>Address:</strong> {order.delivery_address}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ marginBottom: '0.75rem' }}>Order Items</h4>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {order.order_items?.map((item: any) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '1rem',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '8px'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                {item.product_name}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                BDT {parseFloat(item.price_at_time).toFixed(2)} × {item.quantity}
                              </div>
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                              BDT {parseFloat(item.subtotal).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '1.5rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid rgba(31,122,77,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 'bold'
                      }}
                    >
                      <span>Total Amount:</span>
                      <span style={{ color: '#1f7a4d' }}>
                        BDT {parseFloat(order.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    marginTop: '1rem',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    color: '#666'
                  }}
                >
                  {selectedOrder?.id === order.id ? 'Click to collapse' : 'Click to view details'}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>No orders yet</h3>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            Start shopping to place your first order!
          </p>
          <button
            className="primary-btn"
            onClick={() => window.location.href = '/store'}
          >
            Browse Products
          </button>
        </div>
      )}
    </div>
  );
}

export default Orders;
