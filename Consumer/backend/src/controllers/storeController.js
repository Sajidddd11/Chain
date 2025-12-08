import { supabase } from '../config/supabaseClient.js';

// Product Management (Admin)
export const createProduct = async (req, res) => {
  try {
    const { name, description, category, price, unit, stock_quantity, image_url, image_data } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({ message: 'Name, category, and price are required' });
    }

    // Handle image data - if image_data is provided, use it as image_url
    let finalImageUrl = image_url;
    if (image_data) {
      finalImageUrl = image_data; // The base64 data will be stored as image_url
    }

    const { data, error } = await supabase
      .from('products')
      .insert([{
        name,
        description,
        category,
        price,
        unit: unit || 'pcs',
        stock_quantity: stock_quantity || 0,
        image_url: finalImageUrl,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ product: data });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, unit, stock_quantity, image_url, image_data, is_active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (price !== undefined) updates.price = price;
    if (unit !== undefined) updates.unit = unit;
    if (stock_quantity !== undefined) updates.stock_quantity = stock_quantity;
    if (image_url !== undefined) updates.image_url = image_url;
    if (image_data !== undefined) updates.image_url = image_data; // Handle base64 image data
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ product: data });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};

// Product Browsing (Public)
export const getProducts = async (req, res) => {
  try {
    const { category, search, min_price, max_price, in_stock } = req.query;

    let query = supabase.from('products').select('*');

    // Apply filters
    query = query.eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (min_price) {
      query = query.gte('price', parseFloat(min_price));
    }

    if (max_price) {
      query = query.lte('price', parseFloat(max_price));
    }

    if (in_stock === 'true') {
      query = query.gt('stock_quantity', 0);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    res.json({ products: data });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Failed to get products', error: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json({ product: data });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Failed to get product', error: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('is_active', true);

    if (error) throw error;

    const categories = [...new Set(data.map(p => p.category))].sort();

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Failed to get categories', error: error.message });
  }
};

// Cart Management
export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, quantity } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({ message: 'Product ID and quantity are required' });
    }

    // Check if product exists and has enough stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.stock_quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    // Check if item already in cart
    const { data: existingItem } = await supabase
      .from('cart')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', product_id)
      .single();

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      
      if (product.stock_quantity < newQuantity) {
        return res.status(400).json({ message: 'Insufficient stock for requested quantity' });
      }

      const { data, error } = await supabase
        .from('cart')
        .update({ 
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ cart_item: data });
    }

    // Add new item to cart
    const { data, error } = await supabase
      .from('cart')
      .insert([{
        user_id: userId,
        product_id,
        quantity
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ cart_item: data });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: 'Failed to add to cart', error: error.message });
  }
};

export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('cart')
      .select(`
        *,
        products:product_id (
          id,
          name,
          description,
          price,
          unit,
          stock_quantity,
          image_url,
          is_active
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    // Filter out items with deleted products
    const validItems = data.filter(item => item.products);

    res.json({ cart_items: validItems });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Failed to get cart', error: error.message });
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }

    // Get cart item with product info
    const { data: cartItem, error: cartError } = await supabase
      .from('cart')
      .select(`
        *,
        products:product_id (stock_quantity)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (cartError || !cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    if (cartItem.products.stock_quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    const { data, error } = await supabase
      .from('cart')
      .update({ 
        quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ cart_item: data });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: 'Failed to update cart', error: error.message });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: 'Failed to remove from cart', error: error.message });
  }
};

export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: 'Failed to clear cart', error: error.message });
  }
};

// Payment Processing (Demo)
export const createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get cart items to calculate total
    const { data: cartItems, error: cartError } = await supabase
      .from('cart')
      .select(`
        *,
        products:product_id (
          id,
          name,
          price,
          stock_quantity
        )
      `)
      .eq('user_id', userId);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate stock and calculate total
    let totalAmount = 0;

    for (const item of cartItems) {
      if (!item.products) {
        return res.status(400).json({ message: `Product not found in cart` });
      }

      if (item.products.stock_quantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${item.products.name}`
        });
      }

      totalAmount += item.products.price * item.quantity;
    }

    // Generate demo payment intent
    const demoClientSecret = `demo_pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      clientSecret: demoClientSecret,
      amount: totalAmount,
      demo: true
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ message: 'Failed to create payment intent', error: error.message });
  }
};

// Order Management
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      delivery_address,
      delivery_phone,
      delivery_name,
      payment_method,
      notes,
      reward_points_used,
    } = req.body;

    // Get cart items first to check if cart is empty
    const { data: cartItems, error: cartError } = await supabase
      .from('cart')
      .select(`
        *,
        products:product_id (
          id,
          name,
          price,
          stock_quantity
        )
      `)
      .eq('user_id', userId);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate stock and calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of cartItems) {
      if (!item.products) {
        return res.status(400).json({ message: `Product not found in cart` });
      }

      if (item.products.stock_quantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${item.products.name}`,
        });
      }

      const subtotal = item.products.price * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        product_id: item.products.id,
        product_name: item.products.name,
        product_price: item.products.price,
        quantity: item.quantity,
        subtotal,
      });
    }

    const requestedRewardPoints = Number(reward_points_used ?? 0);
    let appliedRewardPoints = 0;
    let rewardDiscount = 0;
    let availableRewardPoints = 0;

    if (requestedRewardPoints > 0) {
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('reward_points')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      availableRewardPoints = Number(userProfile?.reward_points || 0);

      if (requestedRewardPoints > availableRewardPoints) {
        return res.status(400).json({ message: 'Insufficient reward points' });
      }

      const maxPointsBySubtotal = Math.floor(totalAmount * 20);
      appliedRewardPoints = Math.min(requestedRewardPoints, maxPointsBySubtotal);
      rewardDiscount = Number((appliedRewardPoints / 20).toFixed(2));
      rewardDiscount = Math.min(rewardDiscount, totalAmount);
      totalAmount = Number((totalAmount - rewardDiscount).toFixed(2));
    }

    // Generate payment reference for demo purposes
    let paymentReference = null;
    if (['bkash', 'nagad', 'kutta_pay', 'card'].includes(payment_method)) {
      paymentReference = `DEMO_${payment_method.toUpperCase()}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
    }

    // Create order with default delivery info if not provided
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: userId,
        total_amount: totalAmount,
        delivery_address: delivery_address || 'Default Address - Update in profile',
        delivery_phone: delivery_phone || '01XXXXXXXXX',
        delivery_name: delivery_name || 'Customer',
        payment_method: payment_method || 'cash_on_delivery',
        // payment_reference: paymentReference, // Removed for MVP demo to avoid schema errors
        notes,
        reward_points_used: appliedRewardPoints,
        reward_discount: rewardDiscount,
        status: 'pending',
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsWithOrderId);

    if (itemsError) throw itemsError;

    // Update stock quantities
    for (const item of cartItems) {
      const { error: stockError } = await supabase
        .from('products')
        .update({
          stock_quantity: item.products.stock_quantity - item.quantity,
        })
        .eq('id', item.products.id);

      if (stockError) console.error('Stock update error:', stockError);
    }

    if (appliedRewardPoints > 0) {
      const { error: rewardError } = await supabase
        .from('users')
        .update({
          reward_points: availableRewardPoints - appliedRewardPoints,
        })
        .eq('id', userId);

      if (rewardError) {
        console.warn('Failed to deduct reward points after order', rewardError);
      }
    }

    // Clear cart
    await supabase.from('cart').delete().eq('user_id', userId);

    res.status(201).json({
      order: {
        ...order,
        reward_points_used: appliedRewardPoints,
        reward_discount: rewardDiscount,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_name,
          product_price,
          quantity,
          subtotal
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ orders: data });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Failed to get orders', error: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_name,
          product_price,
          quantity,
          subtotal
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    res.json({ order: data });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Failed to get order', error: error.message });
  }
};

// Admin: Get all orders
export const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        *,
        users:user_id (
          full_name,
          email
        ),
        order_items (
          id,
          product_name,
          product_price,
          quantity,
          subtotal
        )
      `);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    res.json({ orders: data });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Failed to get orders', error: error.message });
  }
};

// Admin: Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ order: data });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
};

// Admin: Get store statistics
export const getStoreStats = async (req, res) => {
  try {
    // Get total products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Get active products
    const { count: activeProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get total orders
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Get pending orders
    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get total revenue
    const { data: ordersData } = await supabase
      .from('orders')
      .select('total_amount')
      .in('status', ['delivered', 'shipped']);

    const totalRevenue = ordersData?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

    // Get low stock products
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('*')
      .lte('stock_quantity', 10)
      .eq('is_active', true);

    res.json({
      stats: {
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        totalRevenue: totalRevenue.toFixed(2),
        lowStockCount: lowStockProducts?.length || 0
      },
      lowStockProducts: lowStockProducts || []
    });
  } catch (error) {
    console.error('Get store stats error:', error);
    res.status(500).json({ message: 'Failed to get store statistics', error: error.message });
  }
};
