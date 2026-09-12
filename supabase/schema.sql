-- =========================================================
-- Salary Dashboard - Database Schema
-- Run this in Supabase SQL Editor BEFORE rls.sql
-- =========================================================

-- Enable UUID generation (Supabase usually has this already)
create extension if not exists "pgcrypto";

-- =========================================================
-- profiles
-- One row per authenticated user. Created on first login by app code
-- (or via a trigger below). Kept minimal for V1.
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- settings
-- One row per user. Holds the CURRENT allocation ratios.
-- New salary_records snapshot these ratios at creation time.
-- =========================================================
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  expense_rate numeric(5,2) not null default 60.00,
  saving_rate numeric(5,2) not null default 30.00,
  investment_rate numeric(5,2) not null default 10.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_rates_sum_100 check (
    expense_rate + saving_rate + investment_rate = 100
  ),
  constraint settings_rates_nonnegative check (
    expense_rate >= 0 and saving_rate >= 0 and investment_rate >= 0
  )
);

-- =========================================================
-- accounts
-- User-defined accounts (bank / brokerage / other) that allocations
-- can be assigned to. Never hard-deleted, only deactivated.
-- =========================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null,
  allow_expense boolean not null default false,
  allow_saving boolean not null default false,
  allow_investment boolean not null default false,
  interest_rate numeric(7,4),
  interest_note text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_type_check check (
    account_type in ('銀行', '證券', '其他')
  ),
  constraint accounts_at_least_one_purpose check (
    allow_expense or allow_saving or allow_investment
  )
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);

-- =========================================================
-- salary_records
-- One row per salary entry. Stores a SNAPSHOT of the allocation
-- ratios at the time of creation, so changing settings later never
-- rewrites history.
-- =========================================================
create table if not exists public.salary_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  salary_date date not null,
  salary_amount numeric(12,2) not null,
  expense_rate numeric(5,2) not null,
  saving_rate numeric(5,2) not null,
  investment_rate numeric(5,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salary_amount_positive check (salary_amount > 0),
  constraint salary_rates_sum_100 check (
    expense_rate + saving_rate + investment_rate = 100
  )
);

create index if not exists idx_salary_records_user_id on public.salary_records(user_id);
create index if not exists idx_salary_records_user_date on public.salary_records(user_id, salary_date);

-- =========================================================
-- salary_allocations
-- Exactly 3 rows per salary_record: expense / saving / investment.
-- Each references the account it was assigned to, and can be marked
-- completed independently.
-- =========================================================
create table if not exists public.salary_allocations (
  id uuid primary key default gen_random_uuid(),
  salary_record_id uuid not null references public.salary_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null,
  account_id uuid not null references public.accounts(id) on delete restrict,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allocations_category_check check (
    category in ('expense', 'saving', 'investment')
  ),
  constraint allocations_amount_nonnegative check (amount >= 0),
  constraint allocations_unique_category_per_record unique (salary_record_id, category),
  constraint allocations_completed_at_consistency check (
    (is_completed = false and completed_at is null)
    or (is_completed = true and completed_at is not null)
  )
);

create index if not exists idx_allocations_user_id on public.salary_allocations(user_id);
create index if not exists idx_allocations_salary_record_id on public.salary_allocations(salary_record_id);
create index if not exists idx_allocations_account_id on public.salary_allocations(account_id);

-- =========================================================
-- account_initial_balances
-- Per-PURPOSE starting accumulated amount for an account (money that
-- already existed for that purpose before this app was used). One row
-- per (account, category) — never a single ambiguous total on the
-- account itself, since the same account can serve more than one
-- purpose. Purely a memo value: no interest/compounding is computed
-- from it, and it is never treated as a live bank balance.
-- =========================================================
create table if not exists public.account_initial_balances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_initial_balances_category_check check (
    category in ('expense', 'saving', 'investment')
  ),
  constraint account_initial_balances_amount_nonnegative check (amount >= 0),
  constraint account_initial_balances_unique_per_account_category unique (account_id, category)
);

create index if not exists idx_account_initial_balances_user_id on public.account_initial_balances(user_id);
create index if not exists idx_account_initial_balances_account_id on public.account_initial_balances(account_id);

-- =========================================================
-- Trigger: keep updated_at fresh
-- =========================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_salary_records_updated_at on public.salary_records;
create trigger trg_salary_records_updated_at before update on public.salary_records
  for each row execute function public.set_updated_at();

drop trigger if exists trg_salary_allocations_updated_at on public.salary_allocations;
create trigger trg_salary_allocations_updated_at before update on public.salary_allocations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_account_initial_balances_updated_at on public.account_initial_balances;
create trigger trg_account_initial_balances_updated_at before update on public.account_initial_balances
  for each row execute function public.set_updated_at();

-- =========================================================
-- Trigger: auto-create profile + default settings on first sign up
-- =========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.settings (user_id, expense_rate, saving_rate, investment_rate)
  values (new.id, 60.00, 30.00, 10.00)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- RPC helper: validate_allocation_account
-- Confirms an account (a) belongs to the current user and
-- (b) is allowed for the given category (allow_expense /
-- allow_saving / allow_investment). Raises an exception and
-- aborts the calling transaction if either check fails.
-- Used by create_salary_record / update_salary_record so this
-- is enforced server-side regardless of what the frontend sends
-- (never relies on the <select> dropdown having filtered correctly).
-- =========================================================
create or replace function public.validate_allocation_account(
  p_account_id uuid,
  p_category text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_account public.accounts;
begin
  select * into v_account from public.accounts
    where id = p_account_id and user_id = auth.uid();

  if v_account is null then
    raise exception 'Account not found or not owned by current user';
  end if;

  if p_category = 'expense' and not v_account.allow_expense then
    raise exception 'Account "%" does not allow expense allocations', v_account.name;
  elsif p_category = 'saving' and not v_account.allow_saving then
    raise exception 'Account "%" does not allow saving allocations', v_account.name;
  elsif p_category = 'investment' and not v_account.allow_investment then
    raise exception 'Account "%" does not allow investment allocations', v_account.name;
  end if;
end;
$$;

-- =========================================================
-- RPC: create_salary_record
-- Atomically creates one salary_records row + exactly 3
-- salary_allocations rows (expense/saving/investment), using the
-- CALLING USER's current settings ratios as a snapshot.
-- Runs as the calling user (no SECURITY DEFINER), so all normal
-- RLS policies below still apply to every insert performed inside.
-- =========================================================
create or replace function public.create_salary_record(
  p_salary_date date,
  p_salary_amount numeric,
  p_expense_account_id uuid,
  p_saving_account_id uuid,
  p_investment_account_id uuid
)
returns public.salary_records
language plpgsql
security invoker
as $$
declare
  v_settings public.settings;
  v_record public.salary_records;
  v_expense_amount numeric(12,2);
  v_saving_amount numeric(12,2);
  v_investment_amount numeric(12,2);
begin
  -- Server-side account validation: ownership + category permission.
  -- Never trust that the frontend <select> only offered valid accounts.
  perform public.validate_allocation_account(p_expense_account_id, 'expense');
  perform public.validate_allocation_account(p_saving_account_id, 'saving');
  perform public.validate_allocation_account(p_investment_account_id, 'investment');

  select * into v_settings from public.settings where user_id = auth.uid();
  if v_settings is null then
    raise exception 'Settings not found for current user';
  end if;

  v_expense_amount := round(p_salary_amount * v_settings.expense_rate / 100, 2);
  v_saving_amount := round(p_salary_amount * v_settings.saving_rate / 100, 2);
  -- investment gets the remainder so the three always sum exactly to salary_amount
  v_investment_amount := p_salary_amount - v_expense_amount - v_saving_amount;

  insert into public.salary_records (
    user_id, salary_date, salary_amount, expense_rate, saving_rate, investment_rate
  ) values (
    auth.uid(), p_salary_date, p_salary_amount,
    v_settings.expense_rate, v_settings.saving_rate, v_settings.investment_rate
  )
  returning * into v_record;

  insert into public.salary_allocations
    (salary_record_id, user_id, category, amount, account_id)
  values
    (v_record.id, auth.uid(), 'expense', v_expense_amount, p_expense_account_id),
    (v_record.id, auth.uid(), 'saving', v_saving_amount, p_saving_account_id),
    (v_record.id, auth.uid(), 'investment', v_investment_amount, p_investment_account_id);

  return v_record;
end;
$$;

-- =========================================================
-- RPC: update_salary_record
-- Updates date/amount of an existing salary_record, recomputes the
-- 3 allocation amounts using the ORIGINAL stored rate snapshot
-- (never the current settings), and allows re-assigning accounts.
-- =========================================================
create or replace function public.update_salary_record(
  p_salary_record_id uuid,
  p_salary_date date,
  p_salary_amount numeric,
  p_expense_account_id uuid,
  p_saving_account_id uuid,
  p_investment_account_id uuid
)
returns public.salary_records
language plpgsql
security invoker
as $$
declare
  v_record public.salary_records;
  v_expense_amount numeric(12,2);
  v_saving_amount numeric(12,2);
  v_investment_amount numeric(12,2);
begin
  -- Server-side account validation: ownership + category permission.
  perform public.validate_allocation_account(p_expense_account_id, 'expense');
  perform public.validate_allocation_account(p_saving_account_id, 'saving');
  perform public.validate_allocation_account(p_investment_account_id, 'investment');

  select * into v_record from public.salary_records
    where id = p_salary_record_id and user_id = auth.uid();
  if v_record is null then
    raise exception 'Salary record not found';
  end if;

  v_expense_amount := round(p_salary_amount * v_record.expense_rate / 100, 2);
  v_saving_amount := round(p_salary_amount * v_record.saving_rate / 100, 2);
  v_investment_amount := p_salary_amount - v_expense_amount - v_saving_amount;

  update public.salary_records
    set salary_date = p_salary_date,
        salary_amount = p_salary_amount
    where id = p_salary_record_id and user_id = auth.uid()
    returning * into v_record;

  update public.salary_allocations
    set amount = v_expense_amount, account_id = p_expense_account_id
    where salary_record_id = p_salary_record_id and category = 'expense' and user_id = auth.uid();

  update public.salary_allocations
    set amount = v_saving_amount, account_id = p_saving_account_id
    where salary_record_id = p_salary_record_id and category = 'saving' and user_id = auth.uid();

  update public.salary_allocations
    set amount = v_investment_amount, account_id = p_investment_account_id
    where salary_record_id = p_salary_record_id and category = 'investment' and user_id = auth.uid();

  return v_record;
end;
$$;
