-- Synthetic fixtures only, never commit this transaction.
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); h uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); previous timestamptz; changed integer;
begin
 insert into auth.users(id,email) values(a,a::text||'@nuvabri-validation.invalid'),(b,b::text||'@nuvabri-validation.invalid');
 insert into public.households(id,name,created_by) values(h,'Validation equipment',a);
 insert into public.properties(id,household_id,name,created_by) values(p,h,'Validation equipment',a);
 insert into public.equipment(id,property_id,name,equipment_type,created_by,details) values(e,p,'Fixture','other',a,'{"retained":true}');
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select updated_at into previous from public.equipment where id=e;
 if previous is null then raise exception 'Owner cannot read equipment';end if;
 update public.equipment set name='Updated fixture',brand='Brand',model='Model',serial_number='Serial',installed_at='2025-02-28',installer='Installer',warranty_until='2028-02-29',last_maintenance_at='2026-09-14',notes='Fixture notes',details=details||'{"manual_url":"https://example.com/manual","battery_type":"9 V"}',updated_at=previous+interval '1 second'
  where id=e and property_id=p and updated_at=previous;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Versioned owner update failed';end if;
 update public.equipment set name='Stale write' where id=e and property_id=p and updated_at=previous;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Stale update allowed';end if;
 if not exists(select 1 from public.equipment where id=e and name='Updated fixture' and details->>'retained'='true' and warranty_until='2028-02-29') then raise exception 'Equipment fields were not preserved';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
 if exists(select 1 from public.equipment where id=e) then raise exception 'Cross-owner read allowed';end if;
 update public.equipment set name='Unauthorized' where id=e;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Cross-owner update allowed';end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: equipment fields, owner version update, stale update rejected, cross-owner access denied; fixtures rolled back' as result;
