-- Filter location and publication eligibility BEFORE limiting results.
create or replace function public.hp_directory_location(value text)
returns text language sql immutable security invoker set search_path='' as $$
  select trim(regexp_replace(lower(translate(coalesce(value,''),'ÉÈÊËÀÂÎÏÔÙÛÇéèêëàâîïôùûç','eeeeaaiiouuceeeeaaiiouuc')),'[[:space:]–—-]+',' ','g'));
$$;
revoke all on function public.hp_directory_location(text) from public;
grant execute on function public.hp_directory_location(text) to anon,authenticated,service_role;

create or replace function public.search_directory_professionals(
 p_category text default 'general',p_service text default '',p_city text default '',p_region text default '',p_postal text default ''
) returns setof public.professional_profiles language sql stable security invoker set search_path='' as $$
 with location as (
  select public.hp_directory_location(p_city) city,
   public.hp_directory_location(case when coalesce(p_region,'')<>'' then p_region
    when public.hp_directory_location(p_city) in ('jonquiere','chicoutimi','la baie','saguenay','alma') then 'Saguenay-Lac-Saint-Jean' else '' end) region,
   upper(regexp_replace(coalesce(p_postal,''),'[[:space:]]','','g')) postal
 ) select p.* from public.professional_profiles p cross join location l
 where p.active and cardinality(p.directory_issues)=0
 and (coalesce(p_category,'general') in ('','general') or p.category=p_category)
 and (coalesce(p_service,'')='' or p.service_categories @> array[p_service])
 and (p.serves_all_quebec
  or exists(select 1 from unnest(p.municipalities) city where l.city<>'' and (
   public.hp_directory_location(city)=l.city
   or (length(l.city)>=3 and position(l.city in public.hp_directory_location(city))>0)
   or (length(public.hp_directory_location(city))>=3 and position(public.hp_directory_location(city) in l.city)>0)
   or (l.city in ('jonquiere','chicoutimi','la baie') and public.hp_directory_location(city)='saguenay')))
  or exists(select 1 from unnest(p.regions) region where l.region<>'' and public.hp_directory_location(region)=l.region)
  or exists(select 1 from unnest(p.postal_prefixes) prefix where l.postal<>'' and trim(prefix)<>'' and starts_with(l.postal,upper(regexp_replace(prefix,'[[:space:]]','','g'))))
 ) order by case p.listing_tier when 'sponsored' then 3 when 'partner' then 2 else 1 end desc,p.business_name,p.id limit 120;
$$;
revoke all on function public.search_directory_professionals(text,text,text,text,text) from public,anon;
grant execute on function public.search_directory_professionals(text,text,text,text,text) to authenticated,service_role;

create or replace function public.search_directory_leisure(p_category text,p_city text default '',p_region text default '')
returns setof public.leisure_professionals language sql stable security invoker set search_path='' as $$
 with location as (
  select public.hp_directory_location(p_city) city,
   public.hp_directory_location(case when coalesce(p_region,'')<>'' then p_region
    when public.hp_directory_location(p_city) in ('jonquiere','chicoutimi','la baie','saguenay','alma') then 'Saguenay-Lac-Saint-Jean' else '' end) region
 ), candidates as (
  select p, (l.city<>'' and public.hp_directory_location(p.city)=l.city) local_city,
   (l.region<>'' and public.hp_directory_location(p.region)=l.region) local_region,
   exists(select 1 from unnest(p.service_area) area where l.region<>'' and public.hp_directory_location(area)=l.region) local_area
  from public.leisure_professionals p cross join location l
  where p.active and cardinality(p.directory_issues)=0 and p.categories @> array[p_category]
 ) select (p).* from candidates where local_city or local_region or local_area
 order by (coalesce((p).priority_weight,0) + case when local_city then 300 else 0 end + case when local_region then 180 else 0 end
  + case when local_area then 120 else 0 end + case when (p).partner then 40 else 0 end + case when (p).sponsored then 80 else 0 end) desc,
  (p).business_name,(p).id limit 25;
$$;
revoke all on function public.search_directory_leisure(text,text,text) from public;
grant execute on function public.search_directory_leisure(text,text,text) to anon,authenticated,service_role;
