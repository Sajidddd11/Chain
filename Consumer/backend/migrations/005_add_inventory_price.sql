alter table public.user_inventory
  add column if not exists price numeric(12,2);


