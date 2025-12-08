-- Migration: Create Grocery Store System
-- Run this in your Supabase SQL editor

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'pcs',
  stock_quantity INTEGER DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cart table
CREATE TABLE IF NOT EXISTS cart (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  delivery_address TEXT NOT NULL,
  delivery_phone VARCHAR(20) NOT NULL,
  delivery_name VARCHAR(255) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  product_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Add some sample data
INSERT INTO products (name, description, category, price, unit, stock_quantity, image_url) VALUES
('Fresh Tomatoes', 'Organic ripe tomatoes', 'Vegetables', 120.00, 'kg', 100, 'https://images.unsplash.com/photo-1546470427-e26264be0b93?w=400'),
('Basmati Rice', 'Premium quality basmati rice', 'Grains', 85.00, 'kg', 200, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400'),
('Fresh Milk', 'Full cream fresh milk', 'Dairy', 90.00, 'liter', 50, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400'),
('Chicken Breast', 'Fresh boneless chicken breast', 'Meat', 380.00, 'kg', 75, 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400'),
('Bananas', 'Fresh ripe bananas', 'Fruits', 65.00, 'kg', 120, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400'),
('Whole Wheat Bread', 'Freshly baked whole wheat bread', 'Bakery', 45.00, 'pcs', 80, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'),
('Eggs', 'Farm fresh eggs', 'Dairy', 130.00, 'dozen', 60, 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400'),
('Cooking Oil', 'Refined sunflower oil', 'Cooking Essentials', 220.00, 'liter', 90, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400'),
('Potatoes', 'Fresh potatoes', 'Vegetables', 35.00, 'kg', 150, 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400'),
('Onions', 'Red onions', 'Vegetables', 45.00, 'kg', 130, 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400'),
('Apples', 'Fresh red apples', 'Fruits', 220.00, 'kg', 95, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400'),
('Orange Juice', 'Fresh squeezed orange juice', 'Beverages', 160.00, 'liter', 40, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400');
