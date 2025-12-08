import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';

export function StoreAdmin() {
  const { token, user, logout } = useAuth();
  const { showToast } = useToast();

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2 style={{ color: '#dc2626', fontSize: '1.5rem' }}>Access Denied</h2>
        <span style={{ color: '#6b7280' }}>You need admin privileges to access this page.</span>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'stats'>('stats');
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    unit: 'pcs',
    stock_quantity: '',
    image_url: ''
  });

  useEffect(() => {
    if (activeTab === 'products') {
      loadProducts();
    } else if (activeTab === 'orders') {
      loadOrders();
    } else if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab, token]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/store/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      showToast('error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/store/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      showToast('error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/store/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      showToast('error', 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingProduct
        ? `${import.meta.env.VITE_API_URL}/store/admin/products/${editingProduct.id}`
        : `${import.meta.env.VITE_API_URL}/store/admin/products`;

      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...productForm,
          price: parseFloat(productForm.price),
          stock_quantity: parseInt(productForm.stock_quantity)
        })
      });

      if (!response.ok) throw new Error();

      showToast('success', editingProduct ? 'Product updated' : 'Product created');
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        category: '',
        price: '',
        unit: 'pcs',
        stock_quantity: '',
        image_url: ''
      });
      loadProducts();
    } catch (error) {
      showToast('error', 'Failed to save product');
    }
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      category: product.category,
      price: product.price.toString(),
      unit: product.unit,
      stock_quantity: product.stock_quantity.toString(),
      image_url: product.image_url || ''
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/store/admin/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error();

      showToast('success', 'Product deleted');
      loadProducts();
    } catch (error) {
      showToast('error', 'Failed to delete product');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/store/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error();

      showToast('success', 'Order status updated');
      loadOrders();
    } catch (error) {
      showToast('error', 'Failed to update order status');
    }
  };

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      {/* Admin Header */}
      <div style={{ 
        backgroundColor: '#1f7a4d', 
        color: 'white', 
        padding: '1.5rem 2rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold' }}>
            🏪 Store Admin Dashboard
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.95rem' }}>
            Welcome back, {user?.full_name || 'Administrator'}
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.2)'}
        >
          Logout
        </button>
      </div>

      <div style={{ padding: '2rem' }}>
        {/* Tab Navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '2rem',
          backgroundColor: 'white',
          padding: '0.5rem',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={() => setActiveTab('stats')}
            style={{
              padding: '1rem 2rem',
              border: 'none',
              backgroundColor: activeTab === 'stats' ? '#1f7a4d' : 'transparent',
              color: activeTab === 'stats' ? 'white' : '#6b7280',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>📊</span>
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('products')}
            style={{
              padding: '1rem 2rem',
              border: 'none',
              backgroundColor: activeTab === 'products' ? '#1f7a4d' : 'transparent',
              color: activeTab === 'products' ? 'white' : '#6b7280',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>📦</span>
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '1rem 2rem',
              border: 'none',
              backgroundColor: activeTab === 'orders' ? '#1f7a4d' : 'transparent',
              color: activeTab === 'orders' ? 'white' : '#6b7280',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>🛒</span>
            Orders
          </button>
        </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3>Products</h3>
            <button className="primary-btn" onClick={() => {
              setEditingProduct(null);
              setProductForm({
                name: '',
                description: '',
                category: '',
                price: '',
                unit: 'pcs',
                stock_quantity: '',
                image_url: ''
              });
              setShowProductForm(true);
            }}>
              Add New Product
            </button>
          </div>

          {showProductForm && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '1.5rem',
              borderRadius: '12px',
              marginBottom: '1.5rem'
            }}>
              <h4>{editingProduct ? 'Edit Product' : 'New Product'}</h4>
              <form onSubmit={handleSubmitProduct} style={{ display: 'grid', gap: '1rem' }}>
                <input
                  required
                  placeholder="Product Name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
                <textarea
                  placeholder="Description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={3}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <input
                    required
                    placeholder="Category"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  />
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                  >
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilograms</option>
                    <option value="liter">Liters</option>
                    <option value="dozen">Dozen</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  />
                  <input
                    required
                    type="number"
                    placeholder="Stock Quantity"
                    value={productForm.stock_quantity}
                    onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                  />
                </div>
                <input
                  type="url"
                  placeholder="Image URL"
                  value={productForm.image_url}
                  onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="primary-btn">
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                  <button
                    type="button"
                    className="secondary-update-btn"
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <p>Loading products...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(31,122,77,0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Stock</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id} style={{ borderBottom: '1px solid rgba(31,122,77,0.05)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <img
                            src={product.image_url || 'https://via.placeholder.com/60'}
                            alt={product.name}
                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }}
                          />
                          <div>
                            <div style={{ fontWeight: '600' }}>{product.name}</div>
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              {product.description?.substring(0, 50)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>{product.category}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>
                        BDT {parseFloat(product.price).toFixed(2)}/{product.unit}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <span style={{ 
                          color: product.stock_quantity > 10 ? '#059669' : product.stock_quantity > 0 ? '#d97706' : '#dc2626'
                        }}>
                          {product.stock_quantity}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          backgroundColor: product.is_active ? '#d1fae5' : '#fee2e2',
                          color: product.is_active ? '#059669' : '#dc2626'
                        }}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            className="secondary-update-btn"
                            onClick={() => handleEditProduct(product)}
                            style={{ padding: '0.5rem 1rem' }}
                          >
                            Edit
                          </button>
                          <button
                            className="secondary-update-btn"
                            onClick={() => handleDeleteProduct(product.id)}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', color: '#dc2626' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="card">
          <h3>Orders</h3>
          {loading ? (
            <p>Loading orders...</p>
          ) : orders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders.map(order => (
                <div
                  key={order.id}
                  style={{
                    border: '1px solid rgba(31,122,77,0.1)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    backgroundColor: '#f8f9fa'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                        Order #{order.id.substring(0, 8)}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1f7a4d' }}>
                        BDT {parseFloat(order.total_amount).toFixed(2)}
                      </div>
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(31,122,77,0.2)',
                          marginTop: '0.5rem'
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Customer Details:</div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      <div>{order.delivery_name}</div>
                      <div>{order.delivery_phone}</div>
                      <div>{order.delivery_address}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Order Items:</div>
                    {order.order_items?.map((item: any) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          backgroundColor: 'white',
                          borderRadius: '6px',
                          marginBottom: '0.5rem'
                        }}
                      >
                        <span>{item.product_name} × {item.quantity}</span>
                        <span style={{ fontWeight: '600' }}>BDT {parseFloat(item.subtotal).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No orders found</p>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <div className="card">
          <h3>Store Statistics</h3>
          {loading ? (
            <p>Loading statistics...</p>
          ) : stats ? (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                <div className="summary-card">
                  <h3>Total Products</h3>
                  <p>{stats.stats.totalProducts}</p>
                </div>
                <div className="summary-card">
                  <h3>Active Products</h3>
                  <p>{stats.stats.activeProducts}</p>
                </div>
                <div className="summary-card">
                  <h3>Total Orders</h3>
                  <p>{stats.stats.totalOrders}</p>
                </div>
                <div className="summary-card">
                  <h3>Pending Orders</h3>
                  <p>{stats.stats.pendingOrders}</p>
                </div>
                <div className="summary-card">
                  <h3>Total Revenue</h3>
                  <p>BDT {stats.stats.totalRevenue}</p>
                </div>
                <div className="summary-card">
                  <h3>Low Stock Items</h3>
                  <p>{stats.stats.lowStockCount}</p>
                </div>
              </div>

              {stats.lowStockProducts?.length > 0 && (
                <div>
                  <h4>Low Stock Alert</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {stats.lowStockProducts.map((product: any) => (
                      <div
                        key={product.id}
                        style={{
                          padding: '1rem',
                          backgroundColor: '#fff3cd',
                          border: '1px solid #fcd34d',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontWeight: '600' }}>{product.name}</span>
                        <span style={{ color: '#d97706' }}>
                          Only {product.stock_quantity} left in stock
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
      </div>
    </div>
  );
}

export default StoreAdmin;
