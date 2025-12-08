import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';

type StoreProps = {
  onNavigate?: (page: string) => void;
  focusProductId?: string | null;
  onFocusConsumed?: () => void;
};

export function Store({ onNavigate, focusProductId = null, onFocusConsumed }: StoreProps) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productAlternatives, setProductAlternatives] = useState<any[]>([]);
  const productsRef = useRef<any[]>([]);

  useEffect(() => {
    loadProducts();
    loadCategories();
    if (token) {
      loadCart();
    }

    // Listen for inventory navigation events
    const handleInventoryNavigation = (event: CustomEvent) => {
      console.log('Store received navigation event:', event.detail);
      const { productId, productName } = event.detail;
      if (productId) {
        console.log('Setting pending focus ID:', productId);
        setPendingFocusId(productId);
      } else if (productName) {
        // Search for product by name
        console.log('Searching for product by name:', productName);
        searchAndOpenProduct(productName);
      }
    };

    window.addEventListener('inventory:view-store-product', handleInventoryNavigation as EventListener);

    return () => {
      window.removeEventListener('inventory:view-store-product', handleInventoryNavigation as EventListener);
    };
  }, [token]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    if (focusProductId) {
      setPendingFocusId(focusProductId);
    }
  }, [focusProductId]);

  useEffect(() => {
    if (!pendingFocusId) return;
    const targetId = pendingFocusId;

    const finalize = () => {
      setPendingFocusId(null);
      onFocusConsumed?.();
    };

    const openProductModal = async () => {
      try {
        // First check if we already have this product loaded
        const existing = productsRef.current.find((product) => product.id === targetId);
        if (existing) {
          await openProductPreview(existing);
          finalize();
          return;
        }

        // If not loaded, fetch the product first
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/store/products/${targetId}`,
        );
        if (!response.ok) {
          finalize();
          return;
        }
        const data = await response.json();
        if (data.product) {
          // Add to products list and open modal
          setProducts((prev) => {
            const filtered = prev.filter((p) => p.id !== data.product.id);
            return [data.product, ...filtered];
          });
          await openProductPreview(data.product);
          finalize();
        } else {
          finalize();
        }
      } catch (error) {
        console.error('Failed to open store product modal', error);
        finalize();
      }
    };

    openProductModal();
  }, [pendingFocusId, onFocusConsumed]);

  const loadProducts = async (category = '', search = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      params.append('in_stock', 'true');

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/products?${params}`);
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to load products:', error);
      showToast('error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/categories`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadCart = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setCart(data.cart_items || []);
      setCartCount(data.cart_items?.length || 0);
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  };

  const loadProductAlternatives = async (productName: string) => {
    if (!token) return [];
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/inventory/alternatives/${encodeURIComponent(productName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      return data.alternatives || [];
    } catch (error) {
      console.error('Failed to load alternatives:', error);
      return [];
    }
  };

  const searchAndOpenProduct = async (productName: string) => {
    console.log('searchAndOpenProduct called with:', productName);
    try {
      // First check if we already have this product loaded
      const existing = productsRef.current.find((product) =>
        product.name.toLowerCase().includes(productName.toLowerCase()) ||
        productName.toLowerCase().includes(product.name.toLowerCase())
      );
      
      console.log('Existing product found:', existing);
      
      if (existing) {
        console.log('Opening existing product preview:', existing.name);
        await openProductPreview(existing);
        return;
      }

      // If not loaded, search for the product
      console.log('Fetching products from API...');
      const searchResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/store/products?search=${encodeURIComponent(productName)}`);
      const searchData = await searchResponse.json();
      
      console.log('Search results:', searchData.products);
      
      const foundProduct = searchData.products?.find((product: any) =>
        product.name.toLowerCase().includes(productName.toLowerCase()) ||
        productName.toLowerCase().includes(product.name.toLowerCase())
      );

      console.log('Found product:', foundProduct);

      if (foundProduct) {
        // Add to products list and open modal
        setProducts((prev) => {
          const filtered = prev.filter((p) => p.id !== foundProduct.id);
          return [foundProduct, ...filtered];
        });
        console.log('Opening product preview for:', foundProduct.name);
        await openProductPreview(foundProduct);
      } else {
        console.warn('Product not found in store:', productName);
      }
    } catch (error) {
      console.error('Failed to search and open product:', error);
    }
  };

  const openProductPreview = async (product: any) => {
    setSelectedProduct(product);
    const alternatives = await loadProductAlternatives(product.name);
    setProductAlternatives(alternatives);
  };

  const closeProductPreview = () => {
    setSelectedProduct(null);
    setProductAlternatives([]);
  };

  const navigateToAlternative = (alternative: any) => {
    // Find the alternative product in the current products list
    const altProduct = productsRef.current.find(p => p.id === alternative.product_id);
    if (altProduct) {
      setSelectedProduct(altProduct);
      // Load alternatives for the new product
      loadProductAlternatives(altProduct.name).then(setProductAlternatives);
    }
  };

  const handleSearch = () => {
    loadProducts(selectedCategory, searchQuery);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    loadProducts(category, searchQuery);
  };

  const addToCart = async (productId: string) => {
    if (!token) {
      showToast('error', 'Please login to add items to cart');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ product_id: productId, quantity: 1 })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      showToast('success', 'Item added to cart');
      loadCart();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to add to cart');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Grocery Store</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>Fresh groceries delivered to your door</span>
          {token && (
            <button 
              className="primary-btn" 
              onClick={() => setShowCart(!showCart)}
              style={{ position: 'relative' }}
            >
              🛒 Cart {cartCount > 0 && `(${cartCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, minWidth: '250px' }}
          />
          <button className="primary-btn" onClick={handleSearch}>
            Search
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className={selectedCategory === '' ? 'primary-btn' : 'secondary-update-btn'}
            onClick={() => handleCategorySelect('')}
            style={{ borderRadius: '20px' }}
          >
            All Products
          </button>
          {categories.map(category => (
            <button
              key={category}
              className={selectedCategory === category ? 'primary-btn' : 'secondary-update-btn'}
              onClick={() => handleCategorySelect(category)}
              style={{ borderRadius: '20px' }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="card">
        {loading ? (
          <p>Loading products...</p>
        ) : products.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            {products.map(product => (
              <div
                key={product.id}
                id={`store-product-card-${product.id}`}
                className={`store-product-card`}
                style={{
                  border: '1px solid rgba(31,122,77,0.1)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                  boxShadow: '0 4px 12px rgba(31, 122, 77, 0.08)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(31, 122, 77, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 122, 77, 0.08)';
                }}
                onClick={() => openProductPreview(product)}
              >
                <div style={{
                  width: '100%',
                  height: '200px',
                  overflow: 'hidden',
                  backgroundColor: '#f0f0f0'
                }}>
                  <img
                    src={product.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}
                    alt={product.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                <div style={{ padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#1f7a4d' }}>
                    {product.name}
                  </h4>
                  <p style={{ 
                    margin: '0 0 1rem 0', 
                    color: '#666', 
                    fontSize: '0.9rem',
                    height: '3em',
                    overflow: 'hidden'
                  }}>
                    {product.description}
                  </p>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f7a4d' }}>
                        BDT {parseFloat(product.price).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>
                        per {product.unit}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: product.stock_quantity > 10 ? '#059669' : '#dc2626',
                      fontWeight: '500'
                    }}>
                      {product.stock_quantity > 0 ? (
                        `${product.stock_quantity} in stock`
                      ) : (
                        'Out of stock'
                      )}
                    </div>
                  </div>
                  <button
                    className="primary-btn"
                    onClick={() => addToCart(product.id)}
                    disabled={product.stock_quantity === 0}
                    style={{ 
                      width: '100%',
                      opacity: product.stock_quantity === 0 ? 0.5 : 1,
                      cursor: product.stock_quantity === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No products found</p>
        )}
      </div>

      {/* Cart Sidebar */}
      {showCart && token && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '400px',
          maxWidth: '100%',
          backgroundColor: 'white',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0 }}>Shopping Cart</h3>
            <button
              onClick={() => setShowCart(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {cart.length > 0 ? (
              cart.map(item => (
                <CartItem key={item.id} item={item} onUpdate={loadCart} token={token} />
              ))
            ) : (
              <p style={{ textAlign: 'center', color: '#666' }}>Your cart is empty</p>
            )}
          </div>
          {cart.length > 0 && (
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid rgba(0,0,0,0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                fontSize: '1.2rem',
                fontWeight: 'bold'
              }}>
                <span>Total:</span>
                <span style={{ color: '#1f7a4d' }}>
                  BDT {cart.reduce((sum, item) => 
                    sum + (parseFloat(item.products.price) * item.quantity), 0
                  ).toFixed(2)}
                </span>
              </div>
              <button 
                className="primary-btn" 
                style={{ width: '100%' }}
                onClick={() => onNavigate ? onNavigate('checkout') : window.location.href = '/checkout'}
              >
                Proceed to Checkout
              </button>
            </div>
          )}
        </div>
      )}

      {/* Product Preview Modal */}
      {selectedProduct && (
        <div className="product-preview-modal">
          <div className="product-preview-overlay" onClick={closeProductPreview}>
            <div className="product-preview-content" onClick={(e) => e.stopPropagation()}>
              <div className="product-preview-header">
                <h2>{selectedProduct.name}</h2>
                <button className="product-preview-close" onClick={closeProductPreview}>
                  ×
                </button>
              </div>

              <div className="product-preview-body">
                <div className="product-preview-image">
                  <img
                    src={selectedProduct.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}
                    alt={selectedProduct.name}
                  />
                </div>

                <div className="product-preview-details">
                  <div className="product-preview-price">
                    <span className="price-amount">BDT {parseFloat(selectedProduct.price).toFixed(2)}</span>
                    <span className="price-unit">per {selectedProduct.unit}</span>
                  </div>

                  <div className="product-preview-stock">
                    <span className={`stock-status ${selectedProduct.stock_quantity > 10 ? 'in-stock' : selectedProduct.stock_quantity > 0 ? 'low-stock' : 'out-of-stock'}`}>
                      {selectedProduct.stock_quantity > 0 ? `${selectedProduct.stock_quantity} in stock` : 'Out of stock'}
                    </span>
                  </div>

                  <div className="product-preview-description">
                    <h4>Description</h4>
                    <p>{selectedProduct.description}</p>
                  </div>

                  <div className="product-preview-actions">
                    <button
                      className="primary-btn"
                      onClick={() => {
                        addToCart(selectedProduct.id);
                        closeProductPreview();
                      }}
                      disabled={selectedProduct.stock_quantity === 0}
                      style={{ flex: 1 }}
                    >
                      {selectedProduct.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Cheaper Alternatives Section */}
              {productAlternatives.length > 0 && (
                <div className="product-alternatives-section">
                  <h3>Cheaper Options</h3>
                  <div className="alternatives-grid">
                    {productAlternatives.slice(0, 3).map((alt: any) => (
                      <div
                        key={alt.product_id}
                        className="alternative-card"
                        onClick={() => navigateToAlternative(alt)}
                      >
                        <div className="alternative-header">
                          <span className="alternative-name">{alt.name}</span>
                          <span className="alternative-savings">
                            Save BDT {(parseFloat(selectedProduct.price) - parseFloat(alt.price)).toFixed(2)}
                          </span>
                        </div>
                        <div className="alternative-details">
                          <div className="alternative-price">BDT {parseFloat(alt.price).toFixed(2)}</div>
                          <div className="alternative-reason">{alt.reason}</div>
                        </div>
                        <button
                          className="alternative-buy-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToAlternative(alt);
                          }}
                        >
                          View & Buy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CartItem({ item, onUpdate, token }: any) {
  const { showToast } = useToast();

  const updateQuantity = async (newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/cart/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: newQuantity })
      });

      if (!response.ok) throw new Error();
      onUpdate();
    } catch (error) {
      showToast('error', 'Failed to update quantity');
    }
  };

  const removeItem = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store/cart/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error();
      showToast('success', 'Item removed from cart');
      onUpdate();
    } catch (error) {
      showToast('error', 'Failed to remove item');
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: '1rem',
      padding: '1rem',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <img
        src={item.products.image_url}
        alt={item.products.name}
        style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
      />
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>{item.products.name}</h4>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1f7a4d', marginBottom: '0.5rem' }}>
          BDT {parseFloat(item.products.price).toFixed(2)} × {item.quantity}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => updateQuantity(item.quantity - 1)}
            style={{
              width: '30px',
              height: '30px',
              border: '1px solid #1f7a4d',
              background: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            -
          </button>
          <span style={{ minWidth: '30px', textAlign: 'center' }}>{item.quantity}</span>
          <button
            onClick={() => updateQuantity(item.quantity + 1)}
            style={{
              width: '30px',
              height: '30px',
              border: '1px solid #1f7a4d',
              background: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            +
          </button>
          <button
            onClick={removeItem}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#dc2626',
              cursor: 'pointer'
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default Store;
