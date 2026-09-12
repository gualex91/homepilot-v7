-- Real database assertions, synthetic users only; never replace ROLLBACK with COMMIT.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  entry uuid := gen_random_uuid(); leisure uuid := gen_random_uuid();
  changed integer;
begin
  insert into auth.users(id,email) values (a,a::text||'@nuvabri-validation.invalid'),(b,b::text||'@nuvabri-validation.invalid');
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  insert into public.budget_plans(user_id,config,revision) values(a,'{}',gen_random_uuid());
  insert into public.budget_entries(id,user_id,entry_type,category,amount,entry_date) values(entry,a,'expense','CELI',50,current_date);
  insert into public.leisure_equipment(id,user_id,equipment_type,name) values(leisure,a,'utility_trailer','Validation only');
  if not exists(select 1 from public.budget_plans where user_id=a) or not exists(select 1 from public.budget_entries where id=entry and amount=50) or not exists(select 1 from public.leisure_equipment where id=leisure) then raise exception 'Owner read failed';end if;
  update public.budget_entries set amount=75 where id=entry;
  if not exists(select 1 from public.budget_entries where id=entry and amount=75) then raise exception 'Owner update failed';end if;
  -- A member cannot transfer ownership of a record by changing user_id.
  begin update public.budget_plans set user_id=b where user_id=a;raise exception 'Plan ownership transfer allowed';exception when insufficient_privilege then null;end;
  begin update public.budget_entries set user_id=b where id=entry;raise exception 'Entry ownership transfer allowed';exception when insufficient_privilege then null;end;
  begin update public.leisure_equipment set user_id=b where id=leisure;raise exception 'Leisure ownership transfer allowed';exception when insufficient_privilege then null;end;
  perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated','user_metadata',json_build_object('role','admin'))::text,true);
  if public.is_homepilot_admin() then raise exception 'Metadata granted admin access';end if;
  if exists(select 1 from public.profiles where id=a) or exists(select 1 from public.budget_plans where user_id=a) or exists(select 1 from public.budget_entries where id=entry) or exists(select 1 from public.leisure_equipment where id=leisure) then raise exception 'Cross-owner private read allowed';end if;
  update public.budget_plans set config='{"unauthorized":true}' where user_id=a;get diagnostics changed=row_count;if changed<>0 then raise exception 'Cross-owner plan update';end if;
  delete from public.budget_plans where user_id=a;get diagnostics changed=row_count;if changed<>0 then raise exception 'Cross-owner plan delete';end if;
  update public.budget_entries set amount=999 where id=entry;get diagnostics changed=row_count;if changed<>0 then raise exception 'Cross-owner entry update';end if;
  delete from public.budget_entries where id=entry;get diagnostics changed=row_count;if changed<>0 then raise exception 'Cross-owner entry delete';end if;
  update public.leisure_equipment set name='Unauthorized' where id=leisure;get diagnostics changed=row_count;if changed<>0 then raise exception 'Cross-owner leisure update';end if;
  delete from public.leisure_equipment where id=leisure;get diagnostics changed=row_count;if changed<>0 then raise exception 'Cross-owner leisure delete';end if;
  begin insert into public.budget_entries(user_id,entry_type,category,amount,entry_date) values(a,'income','Salaire',999,current_date);raise exception 'Spoofed entry owner accepted';exception when insufficient_privilege then null;end;
  begin insert into public.leisure_equipment(user_id,equipment_type,name) values(a,'utility_trailer','Unauthorized');raise exception 'Spoofed leisure owner accepted';exception when insufficient_privilege then null;end;
  execute 'reset role';
  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role anon';
  begin perform count(*) from public.budget_plans;raise exception 'Anonymous budget plan access';exception when insufficient_privilege then null;end;
  begin if exists(select 1 from public.budget_entries) then raise exception 'Anonymous entries visible';end if;exception when insufficient_privilege then null;end;
  begin if exists(select 1 from public.leisure_equipment) then raise exception 'Anonymous leisure visible';end if;exception when insufficient_privilege then null;end;
  execute 'reset role';
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  delete from public.budget_plans where user_id=a;get diagnostics changed=row_count;if changed<>1 then raise exception 'Owner plan delete failed';end if;
  delete from public.budget_entries where id=entry;get diagnostics changed=row_count;if changed<>1 then raise exception 'Owner entry delete failed';end if;
  delete from public.leisure_equipment where id=leisure;get diagnostics changed=row_count;if changed<>1 then raise exception 'Owner leisure delete failed';end if;
  execute 'reset role';
end $$;
rollback;
select 'PASS: private budgets, operations, leisure, anonymous access, owner changes and metadata; fixtures rolled back' as result;
