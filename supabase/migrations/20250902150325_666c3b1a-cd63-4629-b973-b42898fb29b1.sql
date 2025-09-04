-- Enable required extension for UUID generation (safe if already enabled)
create extension if not exists pgcrypto;

-- Enum for payment methods matching the app
create type public.payment_method as enum ('pix', 'credit', 'debit');

-- Expenses table storing user-specific expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  description text not null,
  amount numeric(12,2) not null,
  payment_method public.payment_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amount_positive check (amount > 0),
  constraint description_not_blank check (length(trim(description)) > 0)
);

-- Optional FK to auth.users primary key for referential integrity
alter table public.expenses
  add constraint expenses_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- Enable Row Level Security (RLS)
alter table public.expenses enable row level security;

-- Policies: each user can only access their own rows
create policy "Users can select their own expenses"
  on public.expenses
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own expenses"
  on public.expenses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own expenses"
  on public.expenses
  for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own expenses"
  on public.expenses
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Utility trigger to auto-update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.update_updated_at_column();

-- Helpful indexes
create index if not exists idx_expenses_user_created_at on public.expenses (user_id, created_at desc);
create index if not exists idx_expenses_payment_method on public.expenses (payment_method);
