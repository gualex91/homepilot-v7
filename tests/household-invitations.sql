-- Run with a database administrator connection. All fixtures and helpers roll back.
-- Assertions run as authenticated/anon with synthetic claims, never as the admin.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

create temporary table invite_fixture (name text primary key, id uuid not null default gen_random_uuid());
insert into invite_fixture(name) select unnest(array[
  'owner','reader','manager','coowner','stranger','unconfirmed','expired','revoked',
  'crossed','stale','household_guest','former_inviter',
  'home','other_home','property','other_property','foreign_property',
  'invite_read','invite_manager','invite_coowner','invite_unconfirmed','invite_expired',
  'invite_revoked','invite_crossed','invite_stale','invite_household','invite_owner',
  'invite_revoke_test','invite_bad_insert','invite_spoof','invite_bad_status','invite_bad_expiry'
]);
create temporary table invite_test_results (label text primary key);
grant select on invite_fixture to authenticated, anon;
grant insert, select on invite_test_results to authenticated, anon;

create function pg_temp.fixture(key text) returns uuid language sql stable security invoker
as $$ select id from pg_temp.invite_fixture where name = key $$;
create function pg_temp.check_invite(ok boolean, label text) returns void language plpgsql security invoker
as $$ begin
  if ok is distinct from true then raise exception 'FAILED: %', label; end if;
  insert into pg_temp.invite_test_results values (label);
end $$;
create function pg_temp.denied_invite(command text, label text) returns void language plpgsql security invoker
as $$ begin
  begin execute command;
  exception when insufficient_privilege then
    insert into pg_temp.invite_test_results values (label); return;
  end;
  raise exception 'FAILED (operation allowed): %', label;
end $$;
create function pg_temp.invite_claims(person text) returns void language plpgsql security invoker
as $$ begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', pg_temp.fixture(person), 'email', pg_temp.fixture(person)::text || '@invitation-test.invalid',
    'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
select id, id::text || '@invitation-test.invalid',
  case when name = 'unconfirmed' then null else now() end, '{}'::jsonb, '{}'::jsonb
from invite_fixture where name in (
  'owner','reader','manager','coowner','stranger','unconfirmed','expired','revoked',
  'crossed','stale','household_guest','former_inviter'
);

select pg_temp.invite_claims('owner');
set local role authenticated;
insert into public.households (id, name, created_by) values
  (pg_temp.fixture('home'), 'Invitation security fixture', auth.uid()),
  (pg_temp.fixture('other_home'), 'Invitation security fixture', auth.uid());
select pg_temp.check_invite(public.household_role(pg_temp.fixture('home')) = 'owner', 'household creation retains owner');
insert into public.properties (id, household_id, name, created_by) values
  (pg_temp.fixture('property'), pg_temp.fixture('home'), 'Fixture one', auth.uid()),
  (pg_temp.fixture('other_property'), pg_temp.fixture('home'), 'Fixture two', auth.uid()),
  (pg_temp.fixture('foreign_property'), pg_temp.fixture('other_home'), 'Fixture foreign', auth.uid());
select pg_temp.check_invite(public.can_edit_property(pg_temp.fixture('property')), 'property creation retains owner');

insert into public.household_invitations (id, household_id, property_id, email, role, invited_by)
select pg_temp.fixture(inv), pg_temp.fixture('home'), pg_temp.fixture('property'),
  pg_temp.fixture(person)::text || '@invitation-test.invalid', invited_role, auth.uid()
from (values
  ('invite_read','reader','read_only'), ('invite_manager','manager','manager'),
  ('invite_coowner','coowner','co_owner'), ('invite_unconfirmed','unconfirmed','read_only'),
  ('invite_owner','owner','read_only'), ('invite_revoke_test','stranger','read_only')
) as invites(inv, person, invited_role);
select pg_temp.check_invite((select count(*) = 6 from public.household_invitations
  where household_id = pg_temp.fixture('home')), 'owner can create valid scoped invitations');

select pg_temp.denied_invite($q$
  insert into public.household_invitations (id, household_id, property_id, email, role, invited_by)
  values (pg_temp.fixture('invite_bad_insert'), pg_temp.fixture('home'), pg_temp.fixture('foreign_property'),
    'invalid@invitation-test.invalid', 'co_owner', auth.uid())
$q$, 'owner cannot create invitation across households');
select pg_temp.denied_invite($q$
  insert into public.household_invitations (id, household_id, email, role, invited_by)
  values (pg_temp.fixture('invite_spoof'), pg_temp.fixture('home'), 'invalid@invitation-test.invalid',
    'co_owner', pg_temp.fixture('stranger'))
$q$, 'owner cannot spoof invitation issuer');
select pg_temp.denied_invite($q$
  insert into public.household_invitations (id, household_id, email, role, invited_by, status)
  values (pg_temp.fixture('invite_bad_status'), pg_temp.fixture('home'), 'invalid@invitation-test.invalid',
    'co_owner', auth.uid(), 'accepted')
$q$, 'owner cannot create preaccepted invitation');
select pg_temp.denied_invite($q$
  insert into public.household_invitations (id, household_id, email, role, invited_by, expires_at)
  values (pg_temp.fixture('invite_bad_expiry'), pg_temp.fixture('home'), 'invalid@invitation-test.invalid',
    'co_owner', auth.uid(), now() - interval '1 day')
$q$, 'owner cannot create expired invitation');
select pg_temp.denied_invite($q$
  update public.household_invitations set role = 'co_owner' where id = pg_temp.fixture('invite_read')
$q$, 'even issuer must issue a new invitation to change role');
update public.household_invitations set status = 'revoked' where id = pg_temp.fixture('invite_revoke_test');
select pg_temp.check_invite((select status = 'revoked' from public.household_invitations
  where id = pg_temp.fixture('invite_revoke_test')), 'owner can revoke pending invitation');
select public.accept_household_invitation(pg_temp.fixture('invite_owner'));
select pg_temp.check_invite(public.household_role(pg_temp.fixture('home')) = 'owner'
  and (select role = 'owner' from public.property_members where property_id = pg_temp.fixture('property') and user_id = auth.uid()),
  'lower role invitation does not downgrade existing owner');

-- Seed legacy malformed/expired rows as admin solely to test RPC defense in depth.
reset role;
insert into public.household_members (household_id, user_id, role)
  values (pg_temp.fixture('home'), pg_temp.fixture('former_inviter'), 'read_only');
insert into public.household_invitations
  (id, household_id, property_id, email, role, invited_by, status, expires_at)
select pg_temp.fixture(inv), pg_temp.fixture('home'), pg_temp.fixture(prop),
  pg_temp.fixture(person)::text || '@invitation-test.invalid', 'read_only',
  pg_temp.fixture(issuer), state, now() + expiry
from (values
  ('invite_expired','expired','property','owner','pending', interval '-1 day'),
  ('invite_revoked','revoked','property','owner','revoked', interval '1 day'),
  ('invite_crossed','crossed','foreign_property','owner','pending', interval '1 day'),
  ('invite_stale','stale','property','former_inviter','pending', interval '1 day'),
  ('invite_household','household_guest',null,'owner','pending', interval '1 day')
) as legacy(inv, person, prop, issuer, state, expiry);

select pg_temp.invite_claims('reader');
set local role authenticated;
select pg_temp.check_invite((select count(*) = 1 from public.household_invitations), 'recipient sees only own invitation');
select pg_temp.denied_invite($q$update public.household_invitations set role = 'co_owner'
  where id = pg_temp.fixture('invite_read')$q$, 'reader cannot elevate invitation role');
select pg_temp.denied_invite($q$update public.household_invitations set email = 'other@invitation-test.invalid'
  where id = pg_temp.fixture('invite_read')$q$, 'reader cannot retarget recipient');
select pg_temp.denied_invite($q$update public.household_invitations set household_id = pg_temp.fixture('other_home')
  where id = pg_temp.fixture('invite_read')$q$, 'reader cannot change household');
select pg_temp.denied_invite($q$update public.household_invitations set property_id = pg_temp.fixture('other_property')
  where id = pg_temp.fixture('invite_read')$q$, 'reader cannot change property');
select pg_temp.denied_invite($q$update public.household_invitations set expires_at = now() + interval '1 year'
  where id = pg_temp.fixture('invite_read')$q$, 'reader cannot extend expiry');
select pg_temp.denied_invite($q$update public.household_invitations set invited_by = auth.uid()
  where id = pg_temp.fixture('invite_read')$q$, 'reader cannot change issuer');
with changed as (update public.household_invitations set status = 'accepted'
  where id = pg_temp.fixture('invite_read') returning id)
select pg_temp.check_invite((select count(*) = 0 from changed), 'recipient cannot mark accepted directly');
select pg_temp.denied_invite($q$insert into public.household_members (household_id, user_id, role)
  values (pg_temp.fixture('home'), auth.uid(), 'read_only')$q$, 'recipient cannot bypass RPC by inserting membership');
select pg_temp.denied_invite($q$insert into public.property_members (property_id, user_id, role)
  values (pg_temp.fixture('property'), auth.uid(), 'co_owner')$q$, 'recipient cannot bypass RPC by inserting property access');
select public.accept_household_invitation(pg_temp.fixture('invite_read'));
select pg_temp.check_invite(public.household_role(pg_temp.fixture('home')) = 'read_only'
  and public.can_view_property(pg_temp.fixture('property'))
  and not public.can_edit_property(pg_temp.fixture('property'))
  and not public.can_manage_household(pg_temp.fixture('home')), 'reader receives read only access');
select pg_temp.check_invite((select count(*) = 1 from public.properties), 'reader can select only invited property');
with changed as (update public.properties set name = 'Unauthorized' where id = pg_temp.fixture('property') returning id)
select pg_temp.check_invite((select count(*) = 0 from changed), 'reader cannot edit property data');
select pg_temp.denied_invite($q$update public.household_invitations set role = 'co_owner'
  where id = pg_temp.fixture('invite_read')$q$, 'accepted invitation remains immutable');
select public.accept_household_invitation(pg_temp.fixture('invite_read'));
select pg_temp.check_invite((select count(*) = 1 from public.activity_log
  where entity_id = pg_temp.fixture('invite_read')), 'repeat acceptance is idempotent');

-- Replaying an accepted invitation does not reinstate access removed by the owner.
reset role;
update public.household_members set status = 'revoked'
  where household_id = pg_temp.fixture('home') and user_id = pg_temp.fixture('reader');
delete from public.property_members
  where property_id = pg_temp.fixture('property') and user_id = pg_temp.fixture('reader');
set local role authenticated;
select public.accept_household_invitation(pg_temp.fixture('invite_read'));
select pg_temp.check_invite(not public.is_household_member(pg_temp.fixture('home'))
  and not public.can_view_property(pg_temp.fixture('property')), 'replay cannot restore revoked access');

select pg_temp.invite_claims('manager');
select public.accept_household_invitation(pg_temp.fixture('invite_manager'));
select pg_temp.check_invite(public.can_edit_property(pg_temp.fixture('property'))
  and public.household_role(pg_temp.fixture('home')) = 'read_only'
  and not public.can_view_property(pg_temp.fixture('other_property'))
  and not public.can_manage_household(pg_temp.fixture('home')), 'property manager remains scoped');
with changed as (update public.properties set name = 'Authorized fixture edit'
  where id = pg_temp.fixture('property') returning id)
select pg_temp.check_invite((select count(*) = 1 from changed), 'property manager can perform allowed edit');
select pg_temp.invite_claims('coowner');
select public.accept_household_invitation(pg_temp.fixture('invite_coowner'));
select pg_temp.check_invite(public.can_edit_property(pg_temp.fixture('property'))
  and public.household_role(pg_temp.fixture('home')) = 'read_only'
  and not public.can_manage_household(pg_temp.fixture('home'))
  and not public.can_view_property(pg_temp.fixture('other_property'))
  and not public.can_view_property(pg_temp.fixture('foreign_property')), 'property coowner cannot manage whole household');
select pg_temp.denied_invite($q$insert into public.property_members (property_id, user_id, role)
  values (pg_temp.fixture('other_property'), auth.uid(), 'owner')$q$, 'property coowner cannot grant self other property');
select pg_temp.denied_invite($q$insert into public.household_members (household_id, user_id, role)
  values (pg_temp.fixture('home'), pg_temp.fixture('stranger'), 'owner')$q$, 'property coowner cannot appoint household owner');

select pg_temp.invite_claims('stranger');
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_manager'))$q$, 'wrong recipient denied');
select pg_temp.denied_invite($q$select public.accept_household_invitation(gen_random_uuid())$q$, 'unknown invitation denied');
-- Forging an email claim in this SQL harness cannot override the current Auth email.
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.fixture('stranger'),
  'email', pg_temp.fixture('unconfirmed')::text || '@invitation-test.invalid', 'role', 'authenticated')::text, true);
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_unconfirmed'))$q$, 'RPC uses current Auth email instead of JWT email');
select pg_temp.invite_claims('unconfirmed');
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_unconfirmed'))$q$, 'unconfirmed recipient denied');
select pg_temp.invite_claims('expired');
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_expired'))$q$, 'expired invitation denied');
select pg_temp.invite_claims('revoked');
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_revoked'))$q$, 'revoked invitation denied');
select pg_temp.invite_claims('crossed');
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_crossed'))$q$, 'legacy cross household invitation denied');
select pg_temp.invite_claims('stale');
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_stale'))$q$, 'invitation from former manager denied');
select pg_temp.invite_claims('household_guest');
select public.accept_household_invitation(pg_temp.fixture('invite_household'));
select pg_temp.check_invite(public.household_role(pg_temp.fixture('home')) = 'read_only', 'explicit household invitation retains its intended role');

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_read'))$q$, 'anonymous public RPC denied');
select pg_temp.denied_invite($q$select nuvabri_security.accept_household_invitation(pg_temp.fixture('invite_read'))$q$, 'anonymous private function denied');
select pg_temp.denied_invite($q$select * from public.household_invitations$q$, 'anonymous invitation table denied');
reset role;
set local role authenticated;
select pg_temp.denied_invite($q$select public.accept_household_invitation(pg_temp.fixture('invite_read'))$q$, 'missing authenticated identity denied');
reset role;

select count(*) as passed, jsonb_agg(label order by label) as checks from invite_test_results;
rollback;
