-- Regression: same title without equipment must renew independently per property.
-- Uses random synthetic identities, performs no external sends, and rolls back.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
  ha uuid:=gen_random_uuid(); hb uuid:=gen_random_uuid();
  pa uuid:=gen_random_uuid(); pa2 uuid:=gen_random_uuid(); pb uuid:=gen_random_uuid();
  ta uuid:=gen_random_uuid(); ta2 uuid:=gen_random_uuid(); tb uuid:=gen_random_uuid();
  title_marker text:=gen_random_uuid()::text;
  changed integer;
begin
  insert into auth.users(id,email) values(a,a::text||'@nuvabri-validation.invalid'),(b,b::text||'@nuvabri-validation.invalid');
  insert into public.households(id,name,created_by) values(ha,'Validation',a),(hb,'Validation',b);
  insert into public.properties(id,household_id,name,created_by) values(pa,ha,'Validation',a),(pa2,ha,'Validation',a),(pb,hb,'Validation',b);
  insert into public.tasks(id,property_id,title,status,due_at,created_by,recurrence) values
    (ta,pa,title_marker,'todo',current_date,a,'{"unit":"week","interval":1}'),
    (ta2,pa2,title_marker,'todo',current_date,a,'{"unit":"week","interval":1}'),
    (tb,pb,title_marker,'todo',current_date,b,'{"unit":"week","interval":1}');
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  update public.tasks set status='done' where id=ta;
  if not exists(select 1 from public.tasks where property_id=pa and title=title_marker and status='todo' and due_at=current_date+7) then raise exception 'Another property suppressed recurrence';end if;
  update public.tasks set status='done' where id=ta2;
  if not exists(select 1 from public.tasks where property_id=pa2 and title=title_marker and status='todo' and due_at=current_date+7) then raise exception 'Second property suppressed recurrence';end if;
  update public.tasks set status='done' where id=ta;
  update public.tasks set status='todo' where id=ta;
  update public.tasks set status='done' where id=ta;
  if (select count(*) from public.tasks where property_id=pa and title=title_marker and status='todo')<>1 then raise exception 'Repeated completion duplicated task';end if;
  update public.tasks set status='done' where id=tb;get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Cross-owner completion allowed';end if;
  perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
  if not exists(select 1 from public.tasks where id=tb and status='todo' and due_at=current_date) then raise exception 'Other owner task modified';end if;
  update public.tasks set status='done' where id=tb;
  if (select count(*) from public.tasks where property_id=pb and title=title_marker and status='todo' and due_at=current_date+7)<>1 then raise exception 'Other owner recurrence failed';end if;
  execute 'reset role';
end $$;
rollback;
select 'PASS: independent recurrence across properties and owners, no duplicate after repeated completion, unauthorized completion denied; fixtures rolled back' as result;
