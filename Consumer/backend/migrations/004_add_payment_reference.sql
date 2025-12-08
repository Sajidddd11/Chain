-- Migration: Add payment_reference field to orders table
-- Run this in your Supabase SQL editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);