-- Simple admin user creation
-- Run this in your Supabase SQL editor

-- First ensure role column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Delete any existing admin user to avoid conflicts
DELETE FROM users WHERE email = 'admin@store.com';

-- Create fresh admin user
INSERT INTO users (
  full_name,
  email,
  password_hash,
  phone,
  role,
  household_size,
  location
) VALUES (
  'Store Administrator',
  'admin@store.com',
  '$2b$10$y8SU0I91rUkveWKyAQCQEuQqst8SLROgFTmEM82fE2T7hETCPR.bG',
  '+8801000000000',
  'admin',
  1,
  'Dhaka, Bangladesh'
);