-- Nuvabri usage metrics. Remote migration: private_app_analytics_v1.
-- Tables and privileged implementations are outside the exposed public schema.
create schema nuvabri_analytics;
revoke all on schema nuvabri_analytics from public, anon;
grant usage on schema nuvabri_analytics to authenticated;
create table nuvabri_analytics.settings (
  singleton boolean primary key default true check(singleton),
  started_at timestamptz not null default now()
);
insert into nuvabri_analytics.settings default values;
create table nuvabri_analytics.events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  session_id uuid not null,
  received_at timestamptz not null default now(),
  environment text not null check(environment in ('preview','production')),
  name text not null check(name in ('session_start','screen_view','feature_click','professional_click','product_click','calendar_export','app_install','standalone_open')),
  target text not null check(length(target) between 1 and 40),
  business_id uuid,
  business_kind text check(business_kind in ('property','leisure')),
  is_admin boolean not null,
  primary key(user_id,event_id)
);
create index app_events_received on nuvabri_analytics.events(received_at);
create index app_events_user_received on nuvabri_analytics.events(user_id,received_at);
create index app_events_environment_received on nuvabri_analytics.events(environment,received_at);
create unique index app_events_session_once on nuvabri_analytics.events(user_id,environment,session_id,name)
  where name in ('session_start','standalone_open','app_install');
alter table nuvabri_analytics.events enable row level security;
alter table nuvabri_analytics.settings enable row level security;
create policy no_direct_access on nuvabri_analytics.events for all to authenticated using(false) with check(false);
create policy no_direct_access on nuvabri_analytics.settings for all to authenticated using(false) with check(false);
revoke all on all tables in schema nuvabri_analytics from public,anon,authenticated;

create function nuvabri_analytics.record_events(p_events jsonb,p_environment text) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare
  actor uuid:=auth.uid(); item jsonb; n text; t text; bid uuid; kind text;
  accepted integer:=0; inserted integer; admin_actor boolean;
begin
  if actor is null then raise insufficient_privilege using message='Session requise.'; end if;
  if p_environment is null or p_environment not in ('preview','production') or jsonb_typeof(p_events) is distinct from 'array' then raise invalid_parameter_value using message='Mesures invalides.';end if;
  if jsonb_array_length(p_events) not between 1 and 20 or octet_length(p_events::text)>12000 then raise invalid_parameter_value using message='Lot de mesures invalide.';end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,20260910));
  if (select count(*) from nuvabri_analytics.events where user_id=actor and received_at>=now()-interval '1 minute')+jsonb_array_length(p_events)>120
    or (select count(*) from nuvabri_analytics.events where user_id=actor and received_at>=now()-interval '1 day')+jsonb_array_length(p_events)>3000
    then raise sqlstate 'P0001' using message='Limite de mesures atteinte.';end if;
  select exists(select 1 from public.admin_users where user_id=actor) into admin_actor;
  for item in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','session_id','name','target','business_id','business_kind')) then raise invalid_parameter_value using message='Champs de mesure invalides.';end if;
    if coalesce(item->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(item->>'session_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise invalid_parameter_value using message='Identifiant de mesure invalide.';end if;
    n:=item->>'name';t:=item->>'target';bid:=null;kind:=null;
    if not coalesce(
      (n in ('session_start','standalone_open') and t='app') or
      (n='app_install' and t='browser') or
      (n='screen_view' and t in ('home','properties','equipment','leisure','budget','tasks','household','more','hpHelp','hpPartners')) or
      (n='feature_click' and t in ('diy','find_professional','find_products','plan_cost','compare_scenario')) or
      (n='professional_click' and t in ('website','phone','request')) or
      (n='product_click' and t in ('vr_expert','shopping_search')) or
      (n='calendar_export' and t='calendar'),false)
      then raise invalid_parameter_value using message='Événement non permis.';end if;
    if n='professional_click' then
      kind:=item->>'business_kind';
      if coalesce(item->>'business_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or kind is null or kind not in ('property','leisure') then raise invalid_parameter_value using message='Commerce invalide.';end if;
      bid:=(item->>'business_id')::uuid;
      if not ((kind='property' and exists(select 1 from public.professional_profiles where id=bid and active)) or (kind='leisure' and exists(select 1 from public.leisure_professionals where id=bid and active))) then raise invalid_parameter_value using message='Commerce indisponible.';end if;
    elsif item->>'business_id' is not null or item->>'business_kind' is not null then raise invalid_parameter_value using message='Contexte de mesure invalide.';
    end if;
    insert into nuvabri_analytics.events(user_id,event_id,session_id,environment,name,target,business_id,business_kind,is_admin)
      values(actor,(item->>'id')::uuid,(item->>'session_id')::uuid,p_environment,n,t,bid,kind,admin_actor) on conflict do nothing;
    get diagnostics inserted=row_count;accepted:=accepted+inserted;
  end loop;
  return jsonb_build_object('accepted',accepted);
end $$;

create function nuvabri_analytics.dashboard(p_days integer,p_environment text,p_include_admin boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='10s' as $$
declare start_day date; cutoff timestamptz; started timestamptz; answer jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise insufficient_privilege using message='Accès réservé aux administrateurs.';end if;
  if p_days is null or p_days not in (7,30,90) or p_environment is null or p_environment not in ('preview','production') or p_include_admin is null then raise invalid_parameter_value using message='Période invalide.';end if;
  start_day:=(now() at time zone 'America/Toronto')::date-(p_days-1);cutoff:=start_day::timestamp at time zone 'America/Toronto';
  select started_at into started from nuvabri_analytics.settings;
  with selected as materialized (
    select * from nuvabri_analytics.events where environment=p_environment and received_at>=cutoff and (p_include_admin or not is_admin)
  ), daily as (
    select (received_at at time zone 'America/Toronto')::date as day,count(distinct user_id) as users,
      count(*) filter(where name='session_start') as sessions,
      count(*) filter(where name in ('feature_click','professional_click','product_click')) as clicks
    from selected group by 1
  ), days as (
    select start_day+i as day from generate_series(0,p_days-1) i
  ), businesses as (
    select business_id,business_kind,count(*) as clicks,
      count(*) filter(where target='website') as website,count(*) filter(where target='phone') as phone,count(*) filter(where target='request') as requests
    from selected where name='professional_click' group by 1,2 order by clicks desc,business_id limit 10
  )
  select jsonb_build_object(
    'days',p_days,'environment',p_environment,'include_admin',p_include_admin,'timezone','America/Toronto','generated_at',now(),'collection_started_at',started,
    'inventory',jsonb_build_object('accounts',(select count(*) from public.profiles),'new_accounts',(select count(*) from public.profiles where created_at>=cutoff),'households',(select count(*) from public.households),'properties',(select count(*) from public.properties),'leisure_equipment',(select count(*) from public.leisure_equipment),'leads',(select count(*) from public.professional_leads where created_at>=cutoff)),
    'usage',(select jsonb_build_object('active_users',count(distinct user_id),'sessions',count(*) filter(where name='session_start'),'screen_views',count(*) filter(where name='screen_view'),'clicks',count(*) filter(where name in ('feature_click','professional_click','product_click')),'install_signals',count(*) filter(where name='app_install'),'standalone_opens',count(*) filter(where name='standalone_open'),'calendar_exports',count(*) filter(where name='calendar_export'),'professional_clicks',count(*) filter(where name='professional_click'),'product_clicks',count(*) filter(where name='product_click')) from selected),
    'daily',(select jsonb_agg(jsonb_build_object('date',d.day,'users',case when d.day<(started at time zone 'America/Toronto')::date then null else coalesce(a.users,0) end,'sessions',case when d.day<(started at time zone 'America/Toronto')::date then null else coalesce(a.sessions,0) end,'clicks',case when d.day<(started at time zone 'America/Toronto')::date then null else coalesce(a.clicks,0) end) order by d.day) from days d left join daily a on a.day=d.day),
    'screens',coalesce((select jsonb_agg(q order by q.views desc,q.target) from (select target,count(*) as views from selected where name='screen_view' group by target) q),'[]'::jsonb),
    'features',coalesce((select jsonb_agg(q order by q.clicks desc,q.target) from (select target,count(*) as clicks from selected where name='feature_click' group by target) q),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(q order by q.clicks desc,q.target) from (select target,count(*) as clicks from selected where name='product_click' group by target) q),'[]'::jsonb),
    'businesses',coalesce((select jsonb_agg(jsonb_build_object('name',coalesce(p.business_name,l.business_name,'Fiche retirée'),'kind',b.business_kind,'clicks',b.clicks,'website',b.website,'phone',b.phone,'requests',b.requests) order by b.clicks desc,b.business_id) from businesses b left join public.professional_profiles p on b.business_kind='property' and p.id=b.business_id left join public.leisure_professionals l on b.business_kind='leisure' and l.id=b.business_id),'[]'::jsonb)
  ) into answer;
  return answer;
end $$;
revoke all on function nuvabri_analytics.record_events(jsonb,text),nuvabri_analytics.dashboard(integer,text,boolean) from public,anon;
grant execute on function nuvabri_analytics.record_events(jsonb,text),nuvabri_analytics.dashboard(integer,text,boolean) to authenticated;
create function public.hp_record_app_events(p_events jsonb,p_environment text) returns jsonb
language sql security invoker set search_path='' as $$select nuvabri_analytics.record_events(p_events,p_environment)$$;
create function public.hp_app_analytics(p_days integer,p_environment text,p_include_admin boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select nuvabri_analytics.dashboard(p_days,p_environment,p_include_admin)$$;
revoke all on function public.hp_record_app_events(jsonb,text),public.hp_app_analytics(integer,text,boolean) from public,anon;
grant execute on function public.hp_record_app_events(jsonb,text),public.hp_app_analytics(integer,text,boolean) to authenticated;
-- Daily deletion bounds identifiable usage history to approximately 90 days.
create extension if not exists pg_cron;
select cron.schedule('nuvabri-analytics-retention','17 4 * * *',$job$delete from nuvabri_analytics.events where received_at < now()-interval '90 days'$job$);
