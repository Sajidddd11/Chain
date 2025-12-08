-- Migration: Create waste_pickups table and reward points
-- Run this in Supabase SQL editor

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS reward_points integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.waste_pickups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  total_items integer NOT NULL DEFAULT 0,
  total_quantity numeric,
  total_weight_grams numeric,
  reward_points integer NOT NULL DEFAULT 0,
  waste_snapshot jsonb NOT NULL,
  contact_name text,
  contact_phone text,
  contact_location text,
  notes text,
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  admin_id uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waste_pickups_status ON public.waste_pickups(status);
CREATE INDEX IF NOT EXISTS idx_waste_pickups_user_id ON public.waste_pickups(user_id);


