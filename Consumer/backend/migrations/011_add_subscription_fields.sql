-- Add subscription fields to users table for Banglalink AppLink integration
-- This migration adds fields to track user subscription status

alter table public.users
  add column if not exists applink_subscribed boolean not null default false;

alter table public.users
  add column if not exists applink_subscription_status text;

alter table public.users
  add column if not exists applink_subscribed_at timestamptz;

alter table public.users
  add column if not exists applink_unsubscribed_at timestamptz;

-- Add index for subscription queries
create index if not exists idx_users_applink_subscribed on public.users (applink_subscribed);

-- Add comment for documentation
comment on column public.users.applink_subscribed is 'Whether user is subscribed to AppLink services';
comment on column public.users.applink_subscription_status is 'Subscription status: REGISTERED, UNREGISTERED, etc.';
comment on column public.users.applink_subscribed_at is 'Timestamp when user subscribed';
comment on column public.users.applink_unsubscribed_at is 'Timestamp when user unsubscribed';
