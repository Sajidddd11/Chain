-- Migration: Add CaaS charging fields to users table
-- Note: subscription_tier column already exists, we'll use that instead of adding 'tier'

-- Add charging-related fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS charging_reference_no VARCHAR(255),
ADD COLUMN IF NOT EXISTS charging_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS charging_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS last_charge_date TIMESTAMP WITH TIME ZONE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_charging_ref ON public.users(charging_reference_no);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON public.users(subscription_tier);

-- Add comments for documentation
COMMENT ON COLUMN public.users.charging_reference_no IS 'AppLink CaaS request correlator from /caas/direct/debit for OTP verification';
COMMENT ON COLUMN public.users.charging_status IS 'CaaS charging status: OTP_REQUESTED, OTP_VERIFIED, COMPLETED, FAILED';
COMMENT ON COLUMN public.users.charging_amount IS 'Amount charged in BDT (e.g., 49.00 for premium)';
COMMENT ON COLUMN public.users.last_charge_date IS 'Timestamp of last successful CaaS charge';

-- Update existing subscription_tier values if needed (optional, uncomment if you want to standardize)
-- UPDATE public.users SET subscription_tier = 'free' WHERE subscription_tier IS NULL OR subscription_tier = '';

-- Show summary of changes
DO $$ 
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added columns: charging_reference_no, charging_status, charging_amount, last_charge_date';
  RAISE NOTICE 'Using existing column: subscription_tier (instead of adding new tier column)';
  RAISE NOTICE 'Created indexes: idx_users_charging_ref, idx_users_subscription_tier';
END $$;
