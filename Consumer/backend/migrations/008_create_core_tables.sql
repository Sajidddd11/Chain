-- Migration: Create core user data tables
-- Run this in your Supabase SQL editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_item_id UUID REFERENCES food_items(id) ON DELETE SET NULL,
  custom_name VARCHAR(255),
  quantity DECIMAL(10,2),
  unit VARCHAR(50),
  category VARCHAR(100),
  price DECIMAL(10,2),
  purchased_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create consumption_logs table
CREATE TABLE IF NOT EXISTS consumption_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES user_inventory(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50),
  notes TEXT,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_waste_materials table
CREATE TABLE IF NOT EXISTS user_waste_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_name VARCHAR(255) NOT NULL,
  quantity_value DECIMAL(10,2) NOT NULL,
  quantity_unit VARCHAR(50),
  source_item_name VARCHAR(255),
  source_category VARCHAR(100),
  last_source_quantity DECIMAL(10,2),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create food_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS food_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  expiration_days INTEGER,
  sample_cost DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create uploads table if it doesn't exist
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_in_bytes INTEGER NOT NULL,
  inventory_item_id UUID REFERENCES user_inventory(id) ON DELETE SET NULL,
  consumption_log_id UUID REFERENCES consumption_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_category ON user_inventory(category);
CREATE INDEX IF NOT EXISTS idx_user_inventory_expires_at ON user_inventory(expires_at);

CREATE INDEX IF NOT EXISTS idx_consumption_logs_user_id ON consumption_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_consumption_logs_logged_at ON consumption_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_consumption_logs_category ON consumption_logs(category);

CREATE INDEX IF NOT EXISTS idx_user_waste_materials_user_id ON user_waste_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_waste_materials_created_at ON user_waste_materials(created_at);

CREATE INDEX IF NOT EXISTS idx_food_items_category ON food_items(category);

CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_inventory_item_id ON uploads(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_uploads_consumption_log_id ON uploads(consumption_log_id);

-- Add some sample food items (only if table is empty)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM food_items LIMIT 1) THEN
        INSERT INTO food_items (name, category, expiration_days, sample_cost) VALUES
        ('Rice', 'Grains', 365, 85.00),
        ('Chicken Breast', 'Meat', 3, 380.00),
        ('Milk', 'Dairy', 7, 90.00),
        ('Tomatoes', 'Vegetables', 7, 120.00),
        ('Bananas', 'Fruits', 5, 65.00),
        ('Eggs', 'Dairy', 21, 130.00),
        ('Bread', 'Bakery', 3, 45.00),
        ('Potatoes', 'Vegetables', 30, 35.00),
        ('Onions', 'Vegetables', 30, 45.00),
        ('Apples', 'Fruits', 14, 220.00);
    END IF;
END $$;