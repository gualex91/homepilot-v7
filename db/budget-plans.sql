-- Additive schema for the private, user-owned financial plan.
-- Applied to the remote project with migration name private_budget_plans_v1.
create table public.budget_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 200000),
  revision uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.budget_plans enable row level security;
revoke all on public.budget_plans from public, anon;
grant select, insert, update, delete on public.budget_plans to authenticated;
create policy budget_plans_owner_select on public.budget_plans for select to authenticated
  using ((select auth.uid()) = user_id);
create policy budget_plans_owner_insert on public.budget_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy budget_plans_owner_update on public.budget_plans for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budget_plans_owner_delete on public.budget_plans for delete to authenticated
  using ((select auth.uid()) = user_id);
