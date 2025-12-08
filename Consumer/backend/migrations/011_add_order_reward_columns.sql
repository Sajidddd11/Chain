-- Migration: Add reward tracking columns to orders
-- Run this in Supabase SQL editor

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS reward_points_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS reward_discount numeric NOT NULL DEFAULT 0;


