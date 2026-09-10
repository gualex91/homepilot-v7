-- Applied through Supabase migrations. No profiles or lead history are deleted.
-- Eligibility means identifiable and traceable, not a quality endorsement or a live phone check.
create or replace function public.hp_directory_issues(
  business_name text, phone text, website text, source text,
  source_reference text default null, rbq_license text default null
) returns text[] language plpgsql immutable security invoker set search_path = '' as $$
declare
  issues text[] := '{}';
  name text := lower(translate(trim(coalesce(business_name,'')), 'ÉÈÊËÀÂÎÏÔÙÛÇéèêëàâîïôùûç–—', 'eeeeaaiiouuceeeeaaiiouuc--'));
  tel text := regexp_replace(coalesce(phone,''), '(ext[.]?|extension|poste|x|#)[[:space:]]*[0-9]+[[:space:]]*$', '', 'i');
  digits text;
  reference text := coalesce(nullif(trim(source_reference),''),trim(website),'');
  license text := regexp_replace(coalesce(nullif(rbq_license,''),source_reference,''), '^Licence RBQ[[:space:]]+', '', 'i');
begin
  if name !~ '[a-z]' or name in ('inconnu','n/a','na','a confirmer','test') then
    issues := array_append(issues,'missing_business_name');
  elsif name ~ '^[0-9][0-9[:space:].-]{3,}[[:space:].-]*(quebec|canada|ontario|alberta|british columbia|bc|nouveau-brunswick|new brunswick|nova scotia|nouvelle-ecosse|manitoba|saskatchewan|newfoundland|terre-neuve|prince edward island|ile-du-prince-edouard|yukon|nunavut|northwest territories|territoires du nord-ouest|inc|ltee|ltd|limitee|limited|corp)([[:space:].,(-]|$)' then
    issues := array_append(issues,'numbered_company');
  end if;
  digits := regexp_replace(tel,'[^0-9]','','g');
  if length(digits)=11 and left(digits,1)='1' then digits:=substr(digits,2); end if;
  if tel ~ '[^0-9+().[:space:]-]' or digits !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'
     or digits ~ '^([0-9])\1{9}$' or digits ~ '^[0-9]{3}55501[0-9]{2}$' then
    issues := array_append(issues,'invalid_phone');
  end if;
  -- A bare "verified" flag or a generic import label is not supporting evidence.
  if not (
    (coalesce(source,'') in ('rbq_open_data','RBQ_CC_BY_4_0') and license ~ '^[0-9]{4}-[0-9]{4}-[0-9]{2}$')
    or (coalesce(trim(source),'') <> '' and reference ~* '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)*[.][a-z]{2,}([/?#][^[:space:]]*)?$'
        and reference !~* '^https?://(www[.])?(example[.](com|org|net)|localhost|invalid)([/:?#]|$)')
  ) then issues:=array_append(issues,'missing_reference'); end if;
  return issues;
end $$;
revoke all on function public.hp_directory_issues(text,text,text,text,text,text) from public;
grant execute on function public.hp_directory_issues(text,text,text,text,text,text) to anon,authenticated,service_role;

alter table public.professional_profiles
  add column directory_issues text[] not null default '{}',
  add column directory_hidden_at timestamptz,
  add column directory_previous_active boolean;
alter table public.leisure_professionals
  add column directory_issues text[] not null default '{}',
  add column directory_hidden_at timestamptz,
  add column directory_previous_active boolean;

create or replace function public.hp_enforce_directory_quality()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare p jsonb:=to_jsonb(new);
begin
  new.directory_issues:=public.hp_directory_issues(p->>'business_name',p->>'phone',p->>'website',p->>'source',p->>'source_reference',p->>'rbq_license');
  if tg_op='UPDATE' then
    new.directory_hidden_at:=old.directory_hidden_at;
    new.directory_previous_active:=old.directory_previous_active;
  else
    new.directory_hidden_at:=null;
    new.directory_previous_active:=null;
  end if;
  if cardinality(new.directory_issues)>0 then
    if new.directory_hidden_at is null then
      new.directory_hidden_at:=now();
      new.directory_previous_active:=case when tg_op='UPDATE' then old.active else new.active end;
    end if;
    new.active:=false;
  end if;
  -- Correcting evidence alone does not republish a previously hidden profile.
  return new;
end $$;
revoke all on function public.hp_enforce_directory_quality() from public,anon,authenticated;
grant execute on function public.hp_enforce_directory_quality() to service_role;
create trigger enforce_directory_quality before insert or update on public.professional_profiles
  for each row execute function public.hp_enforce_directory_quality();
create trigger enforce_directory_quality before insert or update on public.leisure_professionals
  for each row execute function public.hp_enforce_directory_quality();

-- Retain the original active flag for review; trigger also protects service-role imports.
update public.professional_profiles set active=active;
update public.leisure_professionals set active=active;
alter table public.professional_profiles add constraint professional_directory_quality check (not active or cardinality(directory_issues)=0);
alter table public.leisure_professionals add constraint leisure_directory_quality check (not active or cardinality(directory_issues)=0);
comment on column public.professional_profiles.directory_issues is 'Automatic publication exclusions. Fix the evidence, then explicitly reactivate. Does not certify service quality.';
comment on column public.leisure_professionals.directory_issues is 'Automatic publication exclusions. No live telephone verification is implied.';
