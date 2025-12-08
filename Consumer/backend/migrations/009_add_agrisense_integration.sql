-- Migration: Add Agrisense integration columns to users
-- Run this in your Supabase SQL editor

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_farming_interested boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS agrisense_waste_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS agrisense_farmer_id uuid;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS agrisense_last_sync timestamp with time zone;


