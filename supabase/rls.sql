-- =========================================================
-- Salary Dashboard - Row Level Security Policies
-- Run this AFTER schema.sql
-- Every policy explicitly checks auth.uid() = user_id.
-- SELECT / INSERT / UPDATE / DELETE are defined separately
-- (no blanket "FOR ALL" policies).
-- =========================================================

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.accounts enable row level security;
alter table public.salary_records enable row level security;
alter table public.salary_allocations enable row level security;
alter table public.account_initial_balances enable row level security;

-- =========================================================
-- profiles
-- =========================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
  on public.profiles for delete
  using (auth.uid() = user_id);

-- =========================================================
-- settings
-- =========================================================
drop policy if exists settings_select_own on public.settings;
create policy settings_select_own
  on public.settings for select
  using (auth.uid() = user_id);

drop policy if exists settings_insert_own on public.settings;
create policy settings_insert_own
  on public.settings for insert
  with check (auth.uid() = user_id);

drop policy if exists settings_update_own on public.settings;
create policy settings_update_own
  on public.settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists settings_delete_own on public.settings;
create policy settings_delete_own
  on public.settings for delete
  using (auth.uid() = user_id);

-- =========================================================
-- accounts
-- =========================================================
drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
  on public.accounts for select
  using (auth.uid() = user_id);

drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own
  on public.accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists accounts_delete_own on public.accounts;
create policy accounts_delete_own
  on public.accounts for delete
  using (auth.uid() = user_id);

-- =========================================================
-- salary_records
-- =========================================================
drop policy if exists salary_records_select_own on public.salary_records;
create policy salary_records_select_own
  on public.salary_records for select
  using (auth.uid() = user_id);

drop policy if exists salary_records_insert_own on public.salary_records;
create policy salary_records_insert_own
  on public.salary_records for insert
  with check (auth.uid() = user_id);

drop policy if exists salary_records_update_own on public.salary_records;
create policy salary_records_update_own
  on public.salary_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists salary_records_delete_own on public.salary_records;
create policy salary_records_delete_own
  on public.salary_records for delete
  using (auth.uid() = user_id);

-- =========================================================
-- salary_allocations
-- CRITICAL: a malicious user could try to INSERT/UPDATE a row where
-- user_id = auth.uid() (passes the simple check) but salary_record_id
-- points at ANOTHER user's salary_records row, effectively attaching
-- their own allocation data to someone else's record, or reading
-- allocations by guessing another user's salary_record_id.
-- Every policy therefore ALSO verifies, via subquery, that the
-- referenced salary_records row belongs to auth.uid().
-- =========================================================
drop policy if exists salary_allocations_select_own on public.salary_allocations;
create policy salary_allocations_select_own
  on public.salary_allocations for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.salary_records sr
      where sr.id = salary_allocations.salary_record_id
        and sr.user_id = auth.uid()
    )
  );

drop policy if exists salary_allocations_insert_own on public.salary_allocations;
create policy salary_allocations_insert_own
  on public.salary_allocations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.salary_records sr
      where sr.id = salary_allocations.salary_record_id
        and sr.user_id = auth.uid()
    )
    and exists (
      select 1 from public.accounts a
      where a.id = salary_allocations.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists salary_allocations_update_own on public.salary_allocations;
create policy salary_allocations_update_own
  on public.salary_allocations for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.salary_records sr
      where sr.id = salary_allocations.salary_record_id
        and sr.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.salary_records sr
      where sr.id = salary_allocations.salary_record_id
        and sr.user_id = auth.uid()
    )
    and exists (
      select 1 from public.accounts a
      where a.id = salary_allocations.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists salary_allocations_delete_own on public.salary_allocations;
create policy salary_allocations_delete_own
  on public.salary_allocations for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.salary_records sr
      where sr.id = salary_allocations.salary_record_id
        and sr.user_id = auth.uid()
    )
  );

-- =========================================================
-- account_initial_balances
-- Same defense-in-depth pattern as salary_allocations: checks
-- auth.uid() = user_id AND verifies via subquery that the referenced
-- account_id actually belongs to the current user.
-- =========================================================
drop policy if exists account_initial_balances_select_own on public.account_initial_balances;
create policy account_initial_balances_select_own
  on public.account_initial_balances for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_initial_balances.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists account_initial_balances_insert_own on public.account_initial_balances;
create policy account_initial_balances_insert_own
  on public.account_initial_balances for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_initial_balances.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists account_initial_balances_update_own on public.account_initial_balances;
create policy account_initial_balances_update_own
  on public.account_initial_balances for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_initial_balances.account_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_initial_balances.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists account_initial_balances_delete_own on public.account_initial_balances;
create policy account_initial_balances_delete_own
  on public.account_initial_balances for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_initial_balances.account_id
        and a.user_id = auth.uid()
    )
  );

-- =========================================================
-- Grants: authenticated role needs table + sequence + function access.
-- Supabase's anon/authenticated roles already have these by default
-- on the public schema, but this makes it explicit.
-- =========================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.settings,
  public.accounts,
  public.salary_records,
  public.salary_allocations,
  public.account_initial_balances
to authenticated;
grant execute on function public.validate_allocation_account(uuid, text) to authenticated;
grant execute on function public.create_salary_record(date, numeric, uuid, uuid, uuid) to authenticated;
grant execute on function public.update_salary_record(uuid, date, numeric, uuid, uuid, uuid) to authenticated;
