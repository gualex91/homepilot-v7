-- Private recurring payments, projected into the budget instead of copied.
create table public.asset_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  leisure_equipment_id uuid references public.leisure_equipment(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0 and amount <= 100000000),
  frequency text not null check (frequency in ('weekly','biweekly','semimonthly','monthly','quarterly','yearly')),
  anchor_date date not null check (anchor_date between date '2000-01-01' and date '2099-12-31'),
  second_day integer,
  essential boolean not null default true,
  revision uuid not null,
  updated_at timestamptz not null default now(),
  check (num_nonnulls(property_id,leisure_equipment_id) = 1),
  check (case when frequency = 'semimonthly' then second_day is not null and extract(day from anchor_date) <= 28 and second_day > extract(day from anchor_date) and second_day <= 31 else second_day is null end),
  unique (user_id,property_id),
  unique (user_id,leisure_equipment_id)
);
create index asset_payments_property_idx on public.asset_payments(property_id) where property_id is not null;
create index asset_payments_leisure_idx on public.asset_payments(leisure_equipment_id) where leisure_equipment_id is not null;
alter table public.asset_payments enable row level security;
revoke all on public.asset_payments from public, anon, authenticated;
grant select, insert, update, delete on public.asset_payments to authenticated;
create policy asset_payments_select on public.asset_payments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy asset_payments_insert on public.asset_payments for insert to authenticated
  with check ((select auth.uid()) = user_id and (
    (property_id is not null and exists (select 1 from public.properties p where p.id = property_id)) or
    (leisure_equipment_id is not null and exists (select 1 from public.leisure_equipment l where l.id = leisure_equipment_id and l.user_id = (select auth.uid())))
  ));
create policy asset_payments_update on public.asset_payments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (
    (property_id is not null and exists (select 1 from public.properties p where p.id = property_id)) or
    (leisure_equipment_id is not null and exists (select 1 from public.leisure_equipment l where l.id = leisure_equipment_id and l.user_id = (select auth.uid())))
  ));
create policy asset_payments_delete on public.asset_payments for delete to authenticated
  using ((select auth.uid()) = user_id);
