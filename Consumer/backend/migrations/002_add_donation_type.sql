-- Migration: Add donation_type column to donations table
-- Run this in your Supabase SQL editor

-- Add donation_type column to existing donations table
ALTER TABLE donations
ADD COLUMN IF NOT EXISTS donation_type VARCHAR(20) DEFAULT 'human' CHECK (donation_type IN ('human', 'animal'));

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_donations_donation_type ON donations(donation_type);

-- Update existing donations to have donation_type = 'human' if they don't have one
UPDATE donations
SET donation_type = 'human'
WHERE donation_type IS NULL;