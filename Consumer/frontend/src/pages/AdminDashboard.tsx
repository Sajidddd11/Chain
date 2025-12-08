import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';
import {
  BarChart3,
  Package,
  ShoppingCart,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Activity,
  Menu,
  Search,
  Truck,
  Gift,
  MapPin,
  Phone,
} from 'lucide-react';

export function AdminDashboard() {
  const { token, user, logout } = useAuth();
  const { showToast } = useToast();

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        flexDirection: 'column',
        gap: '2rem',
        padding: '2rem'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '3rem',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)'
          }}>
            <X size={40} color="white" />
          </div>
          <h2 style={{ color: '#dc2626', fontSize: '2rem', fontWeight: '700', margin: '0 0 1rem 0' }}>
            Access Denied
          </h2>
          <p style={{ color: '#6b7280', fontSize: '1.1rem', lineHeight: '1.6', margin: 0 }}>
            You need administrator privileges to access this dashboard.
          </p>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'stats' | 'products' | 'orders' | 'pickups'>('stats');
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [wastePickups, setWastePickups] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cache timestamps to prevent unnecessary reloads
  const [lastLoaded, setLastLoaded] = useState({
    products: 0,
    orders: 0,
    stats: 0,
    pickups: 0,
  });

  const CACHE_DURATION = 30000; // 30 seconds cache

  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    unit: 'pcs',
    stock_quantity: '',
    image_url: '',
    image_file: null as File | null
  });

  useEffect(() => {
    if (activeTab === 'products') {
      loadProducts(true);
    } else if (activeTab === 'orders') {
      loadOrders(true);
    } else if (activeTab === 'stats') {
      loadStats(true);
    } else if (activeTab === 'pickups') {
      loadWastePickups(true);
    }
  }, [activeTab, token]);

  const loadProducts = async (forceReload = false) => {
    const now = Date.now();
    if (!forceReload && products.length > 0 && (now - lastLoaded.products) < CACHE_DURATION) {
      return; // Use cached data
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setProducts(data.products || []);
      setLastLoaded(prev => ({ ...prev, products: now }));
    } catch (error) {
      showToast('error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (forceReload = false) => {
    const now = Date.now();
    if (!forceReload && orders.length > 0 && (now - lastLoaded.orders) < CACHE_DURATION) {
      return; // Use cached data
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setOrders(data.orders || []);
      setLastLoaded(prev => ({ ...prev, orders: now }));
    } catch (error) {
      showToast('error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadWastePickups = async (forceReload = false) => {
    const now = Date.now();
    if (
      !forceReload &&
      wastePickups.length > 0 &&
      (now - lastLoaded.pickups) < CACHE_DURATION
    ) {
      return;
    }

    setPickupLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/waste/admin/pickups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setWastePickups(data.pickups || []);
      setLastLoaded((prev) => ({ ...prev, pickups: now }));
    } catch (error) {
      showToast('error', 'Failed to load waste pickups');
    } finally {
      setPickupLoading(false);
    }
  };

  const loadStats = async (forceReload = false) => {
    const now = Date.now();
    if (!forceReload && stats && (now - lastLoaded.stats) < CACHE_DURATION) {
      return; // Use cached data
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
      setLastLoaded(prev => ({ ...prev, stats: now }));
    } catch (error) {
      showToast('error', 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let imageData = null;

      // Convert image file to base64 if provided
      if (productForm.image_file) {
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(productForm.image_file!);
        });
      }

      const url = editingProduct
        ? `${import.meta.env.VITE_API_URL}/api/store/admin/products/${editingProduct.id}`
        : `${import.meta.env.VITE_API_URL}/api/store/admin/products`;

      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...productForm,
          price: parseFloat(productForm.price),
          stock_quantity: parseInt(productForm.stock_quantity),
          image_data: imageData // Send base64 image data
        })
      });

      if (!response.ok) throw new Error();

      showToast('success', editingProduct ? 'Product updated successfully!' : 'Product created successfully!');
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        category: '',
        price: '',
        unit: 'pcs',
        stock_quantity: '',
        image_url: '',
        image_file: null
      });
      loadProducts(true); // Force reload after product change
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
      image_url: product.image_url || '',
      image_file: null
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/admin/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error();

      showToast('success', 'Product deleted successfully');
      loadProducts(true); // Force reload after product deletion
    } catch (error) {
      showToast('error', 'Failed to delete product');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error();

      showToast('success', 'Order status updated successfully');
      loadOrders(true); // Force reload after order status change
    } catch (error) {
      showToast('error', 'Failed to update order status');
    }
  };

  const handlePickupStatusChange = async (pickupId: string, status: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/waste/admin/pickups/${pickupId}/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) throw new Error();

      showToast('success', 'Pickup status updated');
      loadWastePickups(true);
    } catch (error) {
      showToast('error', 'Failed to update pickup status');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sidebarItems = [
    { id: 'stats', label: 'Dashboard', icon: BarChart3, color: '#3b82f6' },
    { id: 'products', label: 'Products', icon: Package, color: '#10b981' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, color: '#f59e0b' },
    { id: 'pickups', label: 'Waste Pickups', icon: Truck, color: '#22c55e' },
  ];

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarCollapsed ? '80px' : '280px',
        background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
        color: 'white',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 1000,
        boxShadow: '4px 0 20px rgba(0, 0, 0, 0.15)',
        overflow: 'hidden'
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between'
        }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <Package size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Admin Panel</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>Store Management</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem',
              cursor: 'pointer',
              color: 'white',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '1rem 0' }}>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: sidebarCollapsed ? '1rem' : '1rem 1.5rem',
                  background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderLeft: isActive ? `4px solid ${item.color}` : '4px solid transparent',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: sidebarCollapsed ? '0' : '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: isActive ? '600' : '500'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.target as HTMLElement).style.background = 'transparent';
                }}
              >
                <Icon size={20} color={isActive ? item.color : '#cbd5e1'} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              fontWeight: '700',
              color: 'white'
            }}>
              {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: 'white' }}>
                  {user?.full_name || 'Administrator'}
                </p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.8, color: '#cbd5e1' }}>
                  Admin Access
                </p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={logout}
              style={{
                width: '100%',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.3)';
                (e.target as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.5)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.2)';
                (e.target as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.3)';
              }}
            >
              <LogOut size={16} />
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        marginLeft: sidebarCollapsed ? '80px' : '280px',
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        minHeight: '100vh'
      }}>
        {/* Top Header */}
        <header style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
          padding: '1.5rem 2rem',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '1.8rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #1e293b, #475569)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {sidebarItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h1>
              <p style={{
                margin: '0.5rem 0 0 0',
                color: '#64748b',
                fontSize: '0.95rem'
              }}>
                Welcome back, {user?.full_name || 'Administrator'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {activeTab === 'products' && (
                <div style={{ position: 'relative' }}>
                  <Search size={20} style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b'
                  }} />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: '0.75rem 1rem 0.75rem 2.5rem',
                      borderRadius: '12px',
                      border: '2px solid #e2e8f0',
                      fontSize: '0.95rem',
                      width: '300px',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              )}

              <button
                onClick={() => {
                  if (activeTab === 'products') {
                    setEditingProduct(null);
                    setProductForm({
                      name: '',
                      description: '',
                      category: '',
                      price: '',
                      unit: 'pcs',
                      stock_quantity: '',
                      image_url: '',
                      image_file: null
                    });
                    setShowProductForm(true);
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.875rem 1.5rem',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'translateY(0)'}
              >
                <Plus size={18} />
                {activeTab === 'products' ? 'Add Product' : 'New Item'}
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main style={{
          padding: '2rem',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          {/* Statistics Dashboard */}
          {activeTab === 'stats' && (
            <div>
              {loading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '400px',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid #e2e8f0',
                    borderTop: '4px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Loading dashboard...</p>
                </div>
              ) : stats ? (
                <>
                  {/* Stats Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '2rem',
                    marginBottom: '3rem'
                  }}>
                    {/* Total Products */}
                    <div style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      padding: '2.5rem',
                      borderRadius: '20px',
                      color: 'white',
                      boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-20px',
                        right: '-20px',
                        width: '100px',
                        height: '100px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%'
                      }} />
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1.5rem'
                      }}>
                        <div>
                          <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.95rem' }}>Total Products</p>
                          <h2 style={{ margin: 0, fontSize: '3rem', fontWeight: '800' }}>
                            {stats.stats?.totalProducts || 0}
                          </h2>
                        </div>
                        <Package size={48} style={{ opacity: 0.8 }} />
                      </div>
                      <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>
                        {stats.stats?.activeProducts || 0} active products
                      </p>
                    </div>

                    {/* Total Orders */}
                    <div style={{
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      padding: '2.5rem',
                      borderRadius: '20px',
                      color: 'white',
                      boxShadow: '0 20px 40px rgba(240, 147, 251, 0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-20px',
                        right: '-20px',
                        width: '100px',
                        height: '100px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%'
                      }} />
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1.5rem'
                      }}>
                        <div>
                          <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.95rem' }}>Total Orders</p>
                          <h2 style={{ margin: 0, fontSize: '3rem', fontWeight: '800' }}>
                            {stats.stats?.totalOrders || 0}
                          </h2>
                        </div>
                        <ShoppingCart size={48} style={{ opacity: 0.8 }} />
                      </div>
                      <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>
                        {stats.stats?.pendingOrders || 0} pending orders
                      </p>
                    </div>

                    {/* Total Revenue */}
                    <div style={{
                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      padding: '2.5rem',
                      borderRadius: '20px',
                      color: 'white',
                      boxShadow: '0 20px 40px rgba(79, 172, 254, 0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-20px',
                        right: '-20px',
                        width: '100px',
                        height: '100px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%'
                      }} />
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1.5rem'
                      }}>
                        <div>
                          <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.95rem' }}>Total Revenue</p>
                          <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '800' }}>
                            BDT {stats.stats?.totalRevenue || '0.00'}
                          </h2>
                        </div>
                        <DollarSign size={48} style={{ opacity: 0.8 }} />
                      </div>
                      <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>All time earnings</p>
                    </div>

                    {/* Low Stock Alert */}
                    <div style={{
                      background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                      padding: '2.5rem',
                      borderRadius: '20px',
                      color: 'white',
                      boxShadow: '0 20px 40px rgba(250, 112, 154, 0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-20px',
                        right: '-20px',
                        width: '100px',
                        height: '100px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%'
                      }} />
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1.5rem'
                      }}>
                        <div>
                          <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.95rem' }}>Low Stock Alert</p>
                          <h2 style={{ margin: 0, fontSize: '3rem', fontWeight: '800' }}>
                            {stats.stats?.lowStockCount || 0}
                          </h2>
                        </div>
                        <AlertTriangle size={48} style={{ opacity: 0.8 }} />
                      </div>
                      <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>Items need restocking</p>
                    </div>
                  </div>

                  {/* Low Stock Products */}
                  {stats.lowStockProducts?.length > 0 && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(20px)',
                      padding: '2.5rem',
                      borderRadius: '20px',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      marginBottom: '3rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginBottom: '2rem'
                      }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <AlertTriangle size={24} color="white" />
                        </div>
                        <div>
                          <h3 style={{ margin: '0 0 0.25rem 0', color: '#1e293b', fontSize: '1.5rem', fontWeight: '700' }}>
                            Low Stock Products
                          </h3>
                          <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>
                            Products that need immediate attention
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: '1.5rem' }}>
                        {stats.lowStockProducts.map((product: any) => (
                          <div
                            key={product.id}
                            style={{
                              padding: '1.5rem',
                              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                              border: '2px solid #f59e0b',
                              borderRadius: '16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'translateY(0)'}
                          >
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', color: '#92400e', fontSize: '1.2rem', fontWeight: '700' }}>
                                {product.name}
                              </h4>
                              <p style={{ margin: 0, color: '#b45309', fontSize: '0.95rem' }}>
                                Category: {product.category}
                              </p>
                            </div>
                            <div style={{
                              background: '#f59e0b',
                              color: '#78350f',
                              padding: '1rem 1.5rem',
                              borderRadius: '12px',
                              fontWeight: '700',
                              fontSize: '1.2rem',
                              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                            }}>
                              {product.stock_quantity} left
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Stats Overview */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    padding: '2.5rem',
                    borderRadius: '20px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '2rem'
                    }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <BarChart3 size={24} color="white" />
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 0.25rem 0', color: '#1e293b', fontSize: '1.5rem', fontWeight: '700' }}>
                          Quick Stats Overview
                        </h3>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>
                          Key performance indicators at a glance
                        </p>
                      </div>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '2rem'
                    }}>
                      <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                        borderRadius: '16px',
                        border: '2px solid #bbf7d0'
                      }}>
                        <Package size={40} color="#166534" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534', fontSize: '2.5rem', fontWeight: '800' }}>
                          {stats.stats?.activeProducts || 0}
                        </h3>
                        <p style={{ margin: 0, color: '#166534', fontSize: '1rem', fontWeight: '600' }}>Active Products</p>
                      </div>
                      <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                        borderRadius: '16px',
                        border: '2px solid #fcd34d'
                      }}>
                        <Clock size={40} color="#92400e" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#92400e', fontSize: '2.5rem', fontWeight: '800' }}>
                          {stats.stats?.pendingOrders || 0}
                        </h3>
                        <p style={{ margin: 0, color: '#92400e', fontSize: '1rem', fontWeight: '600' }}>Pending Orders</p>
                      </div>
                      <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                        borderRadius: '16px',
                        border: '2px solid #a7f3d0'
                      }}>
                        <CheckCircle size={40} color="#065f46" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#065f46', fontSize: '2.5rem', fontWeight: '800' }}>
                          {(stats.stats?.totalOrders || 0) - (stats.stats?.pendingOrders || 0)}
                        </h3>
                        <p style={{ margin: 0, color: '#065f46', fontSize: '1rem', fontWeight: '600' }}>Completed Orders</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  padding: '4rem',
                  borderRadius: '20px',
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <Activity size={64} color="#cbd5e1" style={{ marginBottom: '1.5rem' }} />
                  <h3 style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '1.5rem' }}>No Statistics Available</h3>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '1.1rem' }}>
                    Statistics will appear here once you have products and orders in your store.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div>
              {showProductForm && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '2rem'
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '24px',
                    padding: '3rem',
                    width: '100%',
                    maxWidth: '600px',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '2rem'
                    }}>
                      <h2 style={{
                        margin: 0,
                        fontSize: '1.8rem',
                        fontWeight: '700',
                        color: '#1e293b'
                      }}>
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
                      </h2>
                      <button
                        onClick={() => {
                          setShowProductForm(false);
                          setEditingProduct(null);
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          color: '#dc2626',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.2)'}
                        onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)'}
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <form onSubmit={handleSubmitProduct} style={{ display: 'grid', gap: '1.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.9rem',
                            color: '#374151',
                            fontWeight: '600'
                          }}>
                            Product Name *
                          </label>
                          <input
                            required
                            placeholder="Enter product name"
                            value={productForm.name}
                            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '1rem',
                              borderRadius: '12px',
                              border: '2px solid #e2e8f0',
                              fontSize: '1rem',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          />
                        </div>
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.9rem',
                            color: '#374151',
                            fontWeight: '600'
                          }}>
                            Category *
                          </label>
                          <input
                            required
                            placeholder="e.g., Vegetables, Fruits"
                            value={productForm.category}
                            onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '1rem',
                              borderRadius: '12px',
                              border: '2px solid #e2e8f0',
                              fontSize: '1rem',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.9rem',
                          color: '#374151',
                          fontWeight: '600'
                        }}>
                          Description
                        </label>
                        <textarea
                          placeholder="Describe your product..."
                          value={productForm.description}
                          onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                          rows={4}
                          style={{
                            width: '100%',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: '2px solid #e2e8f0',
                            fontSize: '1rem',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.9rem',
                            color: '#374151',
                            fontWeight: '600'
                          }}>
                            Price (BDT) *
                          </label>
                          <input
                            required
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={productForm.price}
                            onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '1rem',
                              borderRadius: '12px',
                              border: '2px solid #e2e8f0',
                              fontSize: '1rem',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          />
                        </div>
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.9rem',
                            color: '#374151',
                            fontWeight: '600'
                          }}>
                            Unit *
                          </label>
                          <select
                            value={productForm.unit}
                            onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '1rem',
                              borderRadius: '12px',
                              border: '2px solid #e2e8f0',
                              fontSize: '1rem',
                              transition: 'all 0.2s ease',
                              outline: 'none',
                              background: 'white'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          >
                            <option value="pcs">Pieces</option>
                            <option value="kg">Kilograms</option>
                            <option value="liter">Liters</option>
                            <option value="dozen">Dozen</option>
                          </select>
                        </div>
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.9rem',
                            color: '#374151',
                            fontWeight: '600'
                          }}>
                            Stock Quantity *
                          </label>
                          <input
                            required
                            type="number"
                            placeholder="0"
                            value={productForm.stock_quantity}
                            onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '1rem',
                              borderRadius: '12px',
                              border: '2px solid #e2e8f0',
                              fontSize: '1rem',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.9rem',
                          color: '#374151',
                          fontWeight: '600'
                        }}>
                          Image URL (optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={productForm.image_url}
                          onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: '2px solid #e2e8f0',
                            fontSize: '1rem',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </div>

                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.9rem',
                          color: '#374151',
                          fontWeight: '600'
                        }}>
                          Upload Image (optional)
                        </label>
                        <div style={{
                          border: '2px dashed #cbd5e1',
                          borderRadius: '12px',
                          padding: '2rem',
                          textAlign: 'center',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          background: productForm.image_file ? '#f0fdf4' : '#f8fafc'
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLElement).style.borderColor = '#3b82f6';
                          (e.target as HTMLElement).style.background = '#eff6ff';
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.borderColor = '#cbd5e1';
                          (e.target as HTMLElement).style.background = productForm.image_file ? '#f0fdf4' : '#f8fafc';
                        }}
                        onClick={() => document.getElementById('image-upload')?.click()}
                      >
                          <Upload size={32} color={productForm.image_file ? '#10b981' : '#64748b'} style={{ marginBottom: '1rem' }} />
                          <p style={{
                            margin: '0 0 0.5rem 0',
                            color: '#374151',
                            fontSize: '1rem',
                            fontWeight: '600'
                          }}>
                            {productForm.image_file ? 'Image Selected' : 'Click to upload image'}
                          </p>
                          <p style={{
                            margin: 0,
                            color: '#64748b',
                            fontSize: '0.9rem'
                          }}>
                            {productForm.image_file ? productForm.image_file.name : 'PNG, JPG up to 5MB'}
                          </p>
                        </div>
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setProductForm({ ...productForm, image_file: e.target.files?.[0] || null })}
                          style={{ display: 'none' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                          type="submit"
                          style={{
                            flex: 1,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '1rem 2rem',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                          }}
                          onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'translateY(0)'}
                        >
                          {editingProduct ? 'Update Product' : 'Create Product'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowProductForm(false);
                            setEditingProduct(null);
                          }}
                          style={{
                            flex: 1,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '2px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '12px',
                            padding: '1rem 2rem',
                            color: '#dc2626',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)';
                            (e.target as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)';
                            (e.target as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.2)';
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '400px',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid #e2e8f0',
                    borderTop: '4px solid #10b981',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Loading products...</p>
                </div>
              ) : filteredProducts.length > 0 ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '2rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: '700' }}>
                      Product Management
                    </h3>
                    <span style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}>
                      {filteredProducts.length} products
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.95rem'
                    }}>
                      <thead>
                        <tr style={{
                          background: '#f8fafc',
                          borderBottom: '2px solid #e2e8f0'
                        }}>
                          <th style={{
                            padding: '1.5rem 1rem',
                            textAlign: 'left',
                            fontWeight: '700',
                            color: '#374151',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>Product</th>
                          <th style={{
                            padding: '1.5rem 1rem',
                            textAlign: 'left',
                            fontWeight: '700',
                            color: '#374151',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>Category</th>
                          <th style={{
                            padding: '1.5rem 1rem',
                            textAlign: 'right',
                            fontWeight: '700',
                            color: '#374151',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>Price</th>
                          <th style={{
                            padding: '1.5rem 1rem',
                            textAlign: 'right',
                            fontWeight: '700',
                            color: '#374151',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>Stock</th>
                          <th style={{
                            padding: '1.5rem 1rem',
                            textAlign: 'center',
                            fontWeight: '700',
                            color: '#374151',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>Status</th>
                          <th style={{
                            padding: '1.5rem 1rem',
                            textAlign: 'center',
                            fontWeight: '700',
                            color: '#374151',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map(product => (
                          <tr key={product.id} style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => (e.target as HTMLElement).closest('tr')!.style.background = '#f8fafc'}
                          onMouseLeave={(e) => (e.target as HTMLElement).closest('tr')!.style.background = 'transparent'}
                          >
                            <td style={{ padding: '1.5rem 1rem' }}>
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{
                                  width: '60px',
                                  height: '60px',
                                  background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  flexShrink: 0
                                }}>
                                  {product.image_url ? (
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                      }}
                                    />
                                  ) : (
                                    <Package size={24} color="#64748b" />
                                  )}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p style={{
                                    margin: '0 0 0.25rem 0',
                                    fontWeight: '600',
                                    color: '#1e293b',
                                    fontSize: '1rem'
                                  }}>{product.name}</p>
                                  <p style={{
                                    margin: 0,
                                    color: '#64748b',
                                    fontSize: '0.85rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {product.description?.substring(0, 60)}{product.description?.length > 60 ? '...' : ''}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '1.5rem 1rem', color: '#374151', fontWeight: '500' }}>
                              {product.category}
                            </td>
                            <td style={{
                              padding: '1.5rem 1rem',
                              textAlign: 'right',
                              fontWeight: '700',
                              color: '#059669',
                              fontSize: '1.1rem'
                            }}>
                              BDT {parseFloat(product.price).toFixed(2)}/{product.unit}
                            </td>
                            <td style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>
                              <span style={{
                                fontWeight: '600',
                                color: product.stock_quantity > 10 ? '#059669' : product.stock_quantity > 0 ? '#d97706' : '#dc2626',
                                fontSize: '1rem'
                              }}>
                                {product.stock_quantity}
                              </span>
                            </td>
                            <td style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                              <span style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                backgroundColor: product.is_active ? '#dcfce7' : '#fef2f2',
                                color: product.is_active ? '#166534' : '#991b1b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.025em'
                              }}>
                                {product.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleEditProduct(product)}
                                  style={{
                                    padding: '0.75rem',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#2563eb'}
                                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#3b82f6'}
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  style={{
                                    padding: '0.75rem',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#dc2626'}
                                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#ef4444'}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  padding: '4rem 2rem',
                  borderRadius: '20px',
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem'
                  }}>
                    <Package size={40} color="#64748b" />
                  </div>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.5rem', fontWeight: '700' }}>
                    No Products Found
                  </h3>
                  <p style={{ margin: '0 0 2rem 0', color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6' }}>
                    {searchTerm ? 'No products match your search criteria.' : 'Get started by adding your first product to the store.'}
                  </p>
                  <button
                    onClick={() => setShowProductForm(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '1rem 2rem',
                      color: 'white',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'translateY(0)'}
                  >
                    <Plus size={18} />
                    Add Your First Product
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div>
              {loading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '400px',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid #e2e8f0',
                    borderTop: '4px solid #f59e0b',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Loading orders...</p>
                </div>
              ) : orders.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {orders.map(order => (
                    <div
                      key={order.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'translateY(0)'}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1.5rem',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.25rem'
                          }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <ShoppingCart size={16} color="white" />
                            </div>
                            <div>
                              <h3 style={{
                                margin: '0 0 0.125rem 0',
                                color: '#1e293b',
                                fontSize: '1.1rem',
                                fontWeight: '700'
                              }}>
                                Order #{order.id.substring(0, 8).toUpperCase()}
                              </h3>
                              <p style={{
                                margin: 0,
                                color: '#64748b',
                                fontSize: '0.8rem'
                              }}>
                                {new Date(order.created_at).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '180px' }}>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            color: '#059669',
                            marginBottom: '0.75rem'
                          }}>
                            BDT {parseFloat(order.total_amount).toFixed(2)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: '2px solid #e2e8f0',
                                fontWeight: '600',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                background: 'white',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            >
                              <option value="pending">Pending</option>
                              <option value="processing">Processing</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            {order.status === 'pending' && (
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, 'processing')}
                                  style={{
                                    padding: '0.375rem 0.75rem',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'translateY(-1px)'}
                                  onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'translateY(0)'}
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                                  style={{
                                    padding: '0.375rem 0.75rem',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'translateY(-1px)'}
                                  onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'translateY(0)'}
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem',
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                          }}>
                            <Package size={16} color="#374151" />
                            <h4 style={{
                              margin: 0,
                              color: '#1e293b',
                              fontSize: '0.95rem',
                              fontWeight: '700'
                            }}>
                              Customer Details
                            </h4>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: '1.5' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: '600', minWidth: '50px' }}>Name:</span>
                              <span>{order.delivery_name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: '600', minWidth: '50px' }}>Phone:</span>
                              <span>{order.delivery_phone}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: '600', minWidth: '50px' }}>Address:</span>
                              <span>{order.delivery_address}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{
                          background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                          }}>
                            <ShoppingCart size={16} color="#374151" />
                            <h4 style={{
                              margin: 0,
                              color: '#1e293b',
                              fontSize: '0.95rem',
                              fontWeight: '700'
                            }}>
                              Order Items ({order.order_items?.length || 0})
                            </h4>
                          </div>
                          <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                            {order.order_items?.map((item: any) => (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.75rem',
                                  background: 'white',
                                  borderRadius: '6px',
                                  marginBottom: '0.5rem',
                                  border: '1px solid #e2e8f0',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'translateX(2px)'}
                                onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'translateX(0)'}
                              >
                                <div style={{ flex: 1 }}>
                                  <p style={{
                                    margin: '0 0 0.125rem 0',
                                    fontWeight: '600',
                                    color: '#1e293b',
                                    fontSize: '0.85rem'
                                  }}>
                                    {item.product_name}
                                  </p>
                                  <p style={{
                                    margin: 0,
                                    color: '#64748b',
                                    fontSize: '0.75rem'
                                  }}>
                                    Qty: {item.quantity}
                                  </p>
                                </div>
                                <div style={{
                                  fontWeight: '700',
                                  fontSize: '0.9rem',
                                  color: '#059669'
                                }}>
                                  BDT {parseFloat(item.subtotal).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  padding: '4rem 2rem',
                  borderRadius: '20px',
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem'
                  }}>
                    <ShoppingCart size={40} color="#64748b" />
                  </div>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.5rem', fontWeight: '700' }}>
                    No Orders Found
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6' }}>
                    Orders will appear here once customers start placing orders from your store.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pickups' && (
            <div>
              {pickupLoading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '300px',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid #e2e8f0',
                    borderTop: '4px solid #22c55e',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Loading pickup requests…</p>
                </div>
              ) : wastePickups.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {wastePickups.map((pickup) => (
                    <div
                      key={pickup.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '20px',
                        padding: '1.5rem',
                        border: '1px solid rgba(34, 197, 94, 0.15)',
                        boxShadow: '0 10px 25px rgba(16, 185, 129, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem'
                      }}>
                        <div>
                          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', fontWeight: '700' }}>
                            {pickup.contact_name || pickup.user?.full_name || 'Household'}
                          </h3>
                          <p style={{ margin: '0.25rem 0 0 0', color: '#475569', fontSize: '0.9rem' }}>
                            <MapPin size={14} style={{ marginRight: '0.35rem' }} />
                            {pickup.contact_location || pickup.user?.location || 'No location'}
                          </p>
                          <p style={{ margin: '0.25rem 0 0 0', color: '#475569', fontSize: '0.9rem' }}>
                            <Phone size={14} style={{ marginRight: '0.35rem' }} />
                            {pickup.contact_phone || pickup.user?.phone || 'No phone'}
                          </p>
                        </div>
                        <select
                          value={pickup.status}
                          onChange={(e) => handlePickupStatusChange(pickup.id, e.target.value)}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '10px',
                            border: '2px solid #e2e8f0',
                            fontWeight: '600',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          background: '#ecfccb',
                          borderRadius: '12px',
                          padding: '0.75rem',
                          border: '1px solid #bef264',
                          textAlign: 'center'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#4d7c0f', letterSpacing: '0.05em' }}>Weight</p>
                          <strong style={{ fontSize: '1.2rem', color: '#3f6212' }}>
                            {pickup.total_weight_grams ? `${(Number(pickup.total_weight_grams) / 1000).toFixed(2)} kg` : '—'}
                          </strong>
                        </div>
                        <div style={{
                          background: '#cffafe',
                          borderRadius: '12px',
                          padding: '0.75rem',
                          border: '1px solid #67e8f9',
                          textAlign: 'center'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#0f766e', letterSpacing: '0.05em' }}>Materials</p>
                          <strong style={{ fontSize: '1.2rem', color: '#115e59' }}>
                            {pickup.total_items}
                          </strong>
                        </div>
                        <div style={{
                          background: '#fef3c7',
                          borderRadius: '12px',
                          padding: '0.75rem',
                          border: '1px solid #facc15',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}>
                          <Gift size={18} color="#b45309" />
                          <div>
                            <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.05em' }}>Points</p>
                            <strong style={{ fontSize: '1.1rem', color: '#92400e' }}>+{pickup.reward_points}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '0.75rem 1rem',
                        border: '1px dashed #cbd5f5'
                      }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                          Requested:{' '}
                          {pickup.requested_at
                            ? new Date(pickup.requested_at).toLocaleString()
                            : '—'}
                          {pickup.completed_at && (
                            <>
                              {' '}· Completed:{' '}
                              {new Date(pickup.completed_at).toLocaleString()}
                            </>
                          )}
                        </p>
                      </div>

                      {pickup.waste_snapshot?.length > 0 && (
                        <div>
                          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#0f172a' }}>Bag Contents</p>
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                          }}>
                            {pickup.waste_snapshot.slice(0, 4).map((item: any) => (
                              <span key={item.id || item.material_name} style={{
                                padding: '0.45rem 0.75rem',
                                borderRadius: '999px',
                                background: '#e0f2fe',
                                color: '#0369a1',
                                fontSize: '0.85rem'
                              }}>
                                {item.material_name} · {item.quantity_value} {item.quantity_unit || 'units'}
                              </span>
                            ))}
                            {pickup.waste_snapshot.length > 4 && (
                              <span style={{
                                padding: '0.45rem 0.75rem',
                                borderRadius: '999px',
                                background: '#e2e8f0',
                                color: '#475569',
                                fontSize: '0.85rem'
                              }}>
                                +{pickup.waste_snapshot.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '20px',
                  padding: '2.5rem',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)'
                }}>
                  <Truck size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>No pickup requests yet</h3>
                  <p style={{ margin: 0, color: '#64748b' }}>
                    Waste pickup requests will appear here once households send their inventory.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AdminDashboard;
