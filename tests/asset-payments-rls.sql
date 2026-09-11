-- Integration test against the real policies. Everything is rolled back.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  ha uuid := gen_random_uuid(); hb uuid := gen_random_uuid();
  pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid();
  leisure uuid := gen_random_uuid(); payment uuid := gen_random_uuid();
  entry_id uuid := gen_random_uuid(); changed integer;
begin
  insert into auth.users(id,email) values (a,a::text||'@nuvabri-test.invalid'),(b,b::text||'@nuvabri-test.invalid');
  insert into public.households(id,name,created_by) values (ha,'Test transaction',a),(hb,'Test transaction',b);
  insert into public.properties(id,household_id,name,city,created_by) values (pa,ha,'Test transaction','Test',a),(pb,hb,'Test transaction','Test',b);
  insert into public.leisure_equipment(id,user_id,equipment_type,name) values (leisure,a,'utility_trailer','Test transaction');
  insert into public.budget_entries(id,user_id,household_id,property_id,entry_type,category,amount,entry_date) values (entry_id,a,ha,pa,'expense','Maison',10,current_date);
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  insert into public.asset_payments(id,user_id,property_id,amount,frequency,anchor_date,revision) values (payment,a,pa,70,'weekly',date '2026-09-04',gen_random_uuid());
  if (select count(*) from public.asset_payments where id=payment) <> 1 then raise exception 'Owner SELECT failed'; end if;
  update public.asset_payments set amount=80 where id=payment;
  if (select amount from public.asset_payments where id=payment) <> 80 then raise exception 'Owner UPDATE failed'; end if;
  begin
    insert into public.asset_payments(user_id,property_id,amount,frequency,anchor_date,revision) values (a,pa,70,'weekly',date '2026-09-04',gen_random_uuid());
    raise exception 'Duplicate asset payment accepted';
  exception when unique_violation then null; end;
  perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
  if exists(select 1 from public.asset_payments where id=payment) then raise exception 'Private payment visible to another user'; end if;
  update public.asset_payments set amount=99 where id=payment;get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Cross-owner UPDATE allowed'; end if;
  delete from public.asset_payments where id=payment;get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Cross-owner DELETE allowed'; end if;
  begin
    insert into public.asset_payments(user_id,property_id,amount,frequency,anchor_date,revision) values (b,pa,70,'weekly',date '2026-09-04',gen_random_uuid());
    raise exception 'Inaccessible property accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.asset_payments(user_id,property_id,amount,frequency,anchor_date,revision) values (a,pb,70,'weekly',date '2026-09-04',gen_random_uuid());
    raise exception 'Forged payment owner accepted';
  exception when insufficient_privilege then null; end;
  delete from public.properties where id=pa;get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Unauthorized property DELETE allowed'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  delete from public.properties where id=pa;get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Owner property DELETE failed'; end if;
  if exists(select 1 from public.asset_payments where id=payment) then raise exception 'Property payment did not cascade'; end if;
  if not exists(select 1 from public.budget_entries where id=entry_id and property_id is null) then raise exception 'Recorded expense was lost'; end if;
  insert into public.asset_payments(user_id,leisure_equipment_id,amount,frequency,anchor_date,revision) values (a,leisure,70,'weekly',date '2026-09-04',gen_random_uuid());
  delete from public.leisure_equipment where id=leisure;
  if exists(select 1 from public.asset_payments where leisure_equipment_id=leisure) then raise exception 'Leisure payment did not cascade'; end if;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform count(*) from public.asset_payments;
    raise exception 'Anonymous SELECT allowed';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end $$;
rollback;
select 'PASS: owner isolation, duplicate protection, property permissions, payment cascades, recorded expense retained; fixtures rolled back' as result;
