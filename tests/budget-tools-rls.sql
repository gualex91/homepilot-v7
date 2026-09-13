-- Synthetic users only. Checks the primary-key retry used by financial forms.
-- No schema changes or permanent records; never replace ROLLBACK with COMMIT.
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); item uuid:=gen_random_uuid();
  table_name text; n integer; changed integer;
begin
  insert into auth.users(id,email) values(a,a::text||'@nuvabri-validation.invalid'),(b,b::text||'@nuvabri-validation.invalid');
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  -- Repeat exactly the same insert, as PostgREST ignore-duplicates does.
  for n in 1..2 loop
    insert into public.budget_assets(id,user_id,asset_type,name,estimated_value,institution,notes)
      values(item,a,'vehicle','Fixture',1200,'Institution','Notes') on conflict(id) do nothing;
    insert into public.budget_debts(id,user_id,debt_type,name,institution,original_balance,current_balance,interest_rate,payment_amount,payment_frequency,next_payment_date,target_payoff_date,notes)
      values(item,a,'personal_loan','Fixture','Institution',1200,1200,0,100,'weekly','2026-09-20','2027-01-01','Notes') on conflict(id) do nothing;
    insert into public.budget_savings_goals(id,user_id,name,target_amount,current_amount,target_date,notes)
      values(item,a,'Fixture',1000,100,'2027-09-20','Notes') on conflict(id) do nothing;
    insert into public.budget_recurring_payments(id,user_id,name,category,amount,frequency,next_due_date,reminder_days,autopay,notes)
      values(item,a,'Fixture','Internet',80,'monthly','2026-09-20',7,true,'Notes') on conflict(id) do nothing;
    insert into public.mortgage_renewals(id,user_id,lender,renewal_date,current_balance,interest_rate,payment_amount,payment_frequency,reminder_days,notes)
      values(item,a,'Institution','2027-09-20',120000,4.5,800,'monthly',120,'Notes') on conflict(id) do nothing;
    insert into public.budget_category_targets(id,user_id,category,monthly_target,alert_threshold)
      values(item,a,'Épicerie',600,80) on conflict(user_id,category) do update set monthly_target=excluded.monthly_target,alert_threshold=excluded.alert_threshold;
  end loop;
  foreach table_name in array array['budget_assets','budget_debts','budget_savings_goals','budget_recurring_payments','mortgage_renewals','budget_category_targets'] loop
    execute format('select count(*) from public.%I where id=$1',table_name) into n using item;
    if n<>1 then raise exception 'Owner read or duplicate protection failed: %',table_name; end if;
    begin
      execute format('update public.%I set user_id=$1 where id=$2',table_name) using b,item;
      raise exception 'Ownership transfer allowed: %',table_name;
    exception when insufficient_privilege then null; end;
    perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
    execute format('select count(*) from public.%I where id=$1',table_name) into n using item;
    if n<>0 then raise exception 'Cross-owner read allowed: %',table_name; end if;
    execute format('update public.%I set updated_at=now() where id=$1',table_name) using item;
    get diagnostics changed=row_count;
    if changed<>0 then raise exception 'Cross-owner update allowed: %',table_name; end if;
    execute format('delete from public.%I where id=$1',table_name) using item;
    get diagnostics changed=row_count;
    if changed<>0 then raise exception 'Cross-owner delete allowed: %',table_name; end if;
    perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
    execute format('delete from public.%I where id=$1',table_name) using item;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'Owner delete failed: %',table_name; end if;
  end loop;
  execute 'reset role';
end $$;
rollback;
select 'PASS: six financial forms, one row per repeated insert, ownership transfer denied, cross-owner reads/updates/deletes denied, owner deletion; fixtures rolled back' as result;
