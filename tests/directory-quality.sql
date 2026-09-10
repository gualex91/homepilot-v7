-- Run against the migrated database. All fixtures are rolled back.
begin;
do $$
declare name text; issues text[]; test_id uuid; profile public.professional_profiles; leisure public.leisure_professionals;
begin
 foreach name in array array['1234-5678 Québec inc.','96769 Canada inc.','1000476006 ONTARIO INC.','1234567 inc.','1234–5678 QUÉBEC Ltée','3313045 Nova Scotia Compagny','4800795  Nova Scotia Company','123456 Manitoba Ltd.'] loop
  issues:=public.hp_directory_issues(name,'418-234-6789',null,'rbq_open_data','1234-5678-90');
  if not ('numbered_company'=any(issues)) then raise exception 'Numbered name passed: %',name; end if;
 end loop;
 foreach name in array array['1 KR électrique inc.','100% Concept Construction s.e.n.c.','Construction 2000','Aventures 138','3R Plomberie'] loop
  if cardinality(public.hp_directory_issues(name,'+1 (418) 234-6789 poste 25',null,'rbq_open_data','1234-5678-90'))<>0 then raise exception 'Commercial name rejected: %',name; end if;
 end loop;
 foreach name in array array['','1888254661','5140000000','4185550123','2222222222','4182346789abc'] loop
  if not ('invalid_phone'=any(public.hp_directory_issues('Atelier exemple',name,null,'rbq_open_data','1234-5678-90'))) then raise exception 'Invalid phone passed: %',name; end if;
 end loop;
 if not ('missing_reference'=any(public.hp_directory_issues('Atelier exemple','4182346789',null,'Nuvabri verified web 2026-09-09'))) then raise exception 'Import label treated as evidence'; end if;
 if not ('missing_reference'=any(public.hp_directory_issues('Atelier exemple','4182346789','javascript:alert(1)','manual'))) then raise exception 'Unsafe URL accepted'; end if;
 if cardinality(public.hp_directory_issues('Atelier exemple','4182346789','https://www.rbq.gouv.qc.ca/','manual'))<>0 then raise exception 'Traceable URL rejected'; end if;

 insert into public.professional_profiles(business_name,category,phone,source,rbq_license,active)
 values ('1234-5678 Québec inc.','general','4182346789','rbq_open_data','1234-5678-90',true) returning id into test_id;
 -- Simulate the service-role import attempting to republish and clear the issues.
 update public.professional_profiles set active=true,directory_issues='{}',directory_hidden_at=null where id=test_id;
 select * into profile from public.professional_profiles where id=test_id;
 if profile.active or profile.directory_hidden_at is null or cardinality(profile.directory_issues)=0 then raise exception 'Import bypassed quarantine'; end if;
 update public.professional_profiles set business_name='Atelier de validation' where id=test_id;
 select * into profile from public.professional_profiles where id=test_id;
 if profile.active or cardinality(profile.directory_issues)<>0 then raise exception 'Correction should permit explicit reactivation only'; end if;
 update public.professional_profiles set active=true where id=test_id;
 if not (select active from public.professional_profiles where id=test_id) then raise exception 'Corrected profile cannot be restored'; end if;
 insert into public.leisure_professionals(business_name,phone,source,verified,active)
 values ('Atelier de validation','4182346789','verified',true,true) returning * into leisure;
 if leisure.active or not ('missing_reference'=any(leisure.directory_issues)) then raise exception 'Verified flag bypassed leisure evidence'; end if;
end $$;
-- Put a local record beyond a full page of unrelated records; it must still be found.
insert into public.professional_profiles(business_name,category,phone,source,rbq_license,regions,active)
select 'A validation '||n,'general','4182346789','rbq_open_data','1234-5678-90',array['Région de validation éloignée'],true from generate_series(1,130) n;
insert into public.professional_profiles(business_name,category,phone,source,rbq_license,regions,active)
values ('Z validation locale','general','4182346789','rbq_open_data','1234-5678-90',array['Région de validation locale'],true);
set local role authenticated;
do $$
begin
 if (select count(*) from public.search_directory_professionals(p_region=>'Région de validation locale'))<>1 then raise exception 'Location filtered after limit'; end if;
 if exists(select 1 from public.professional_profiles where not active) then raise exception 'Non-admin sees quarantined profiles'; end if;
 if exists(select 1 from public.search_directory_professionals(p_city=>'Jonquière') where cardinality(directory_issues)>0) then raise exception 'Search returned ineligible profile'; end if;
end $$;
rollback;
