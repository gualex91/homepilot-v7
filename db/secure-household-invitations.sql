-- Invitation authorization repair. Apply atomically with Supabase apply_migration.
-- No existing invitation, member, property or budget rows are rewritten.

create schema if not exists nuvabri_security;
revoke all on schema nuvabri_security from public, anon;
grant usage on schema nuvabri_security to authenticated;

-- Recipients may read an invitation, but cannot rewrite its authorization inputs.
drop policy if exists hi_update_invitee_accept on public.household_invitations;
drop policy if exists hi_update_manager_or_invitee on public.household_invitations;
drop policy if exists hi_revoke_manager on public.household_invitations;
revoke all on public.household_invitations from public, anon;
revoke update, delete on public.household_invitations from authenticated;
revoke update (id, household_id, email, role, invited_by, token, status,
  expires_at, created_at, property_id) on public.household_invitations from authenticated;
grant select, insert on public.household_invitations to authenticated;
grant update (status) on public.household_invitations to authenticated;

create policy hi_revoke_manager on public.household_invitations
  for update to authenticated
  using (status = 'pending' and public.can_manage_household(household_id))
  with check (status = 'revoked' and public.can_manage_household(household_id));

drop policy if exists hi_insert_manager on public.household_invitations;
create policy hi_insert_manager on public.household_invitations
  for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and public.can_manage_household(household_id)
    and status = 'pending'
    and expires_at > now()
    and btrim(email) <> ''
    and (property_id is null or exists (
      select 1 from public.properties p
      where p.id = household_invitations.property_id
        and p.household_id = household_invitations.household_id
    ))
  );

-- Joining with an invitation must go through the validated, atomic RPC.
-- Household creation still adds its owner via handle_new_household_owner().
drop policy if exists hm_insert_valid_invitee on public.household_members;
drop policy if exists hm_insert_owner_or_invitee on public.household_members;
drop policy if exists hm_insert_managers on public.household_members;
create policy hm_insert_managers on public.household_members
  for insert to authenticated
  with check (public.can_manage_household(household_id));

create or replace function nuvabri_security.accept_household_invitation(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  inv public.household_invitations%rowtype;
  membership_role text;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  -- Use the current verified Auth email, not a stale or editable client claim.
  select lower(btrim(email)) into caller_email
    from auth.users
    where id = caller_id and email_confirmed_at is not null
    for share;
  if caller_email is null or caller_email = '' then
    raise exception using errcode = '42501', message = 'Verified email required';
  end if;

  select * into inv from public.household_invitations
    where id = invite_id for update;
  if not found or lower(btrim(inv.email)) is distinct from caller_email then
    raise exception using errcode = '42501', message = 'Invitation unavailable';
  end if;

  -- A retry must never regrant permissions after a later membership revocation.
  if inv.status = 'accepted' then
    return;
  end if;
  if inv.status <> 'pending' or inv.expires_at <= now() then
    raise exception using errcode = '42501', message = 'Invitation unavailable';
  end if;

  -- An invitation cannot outlive its issuer's permission to share this household.
  perform 1 from public.household_members
    where household_id = inv.household_id and user_id = inv.invited_by
      and status = 'active' and role in ('owner', 'co_owner')
    for share;
  if not found then
    raise exception using errcode = '42501', message = 'Invitation unavailable';
  end if;

  if inv.property_id is not null then
    perform 1 from public.properties
      where id = inv.property_id and household_id = inv.household_id
      for share;
    if not found then
      raise exception using errcode = '42501', message = 'Invitation unavailable';
    end if;
  end if;

  -- A property-scoped co-owner must not become a co-owner of the whole household.
  membership_role := case when inv.property_id is null then inv.role else 'read_only' end;
  insert into public.household_members as existing (household_id, user_id, role, status)
    values (inv.household_id, caller_id, membership_role, 'active')
    on conflict (household_id, user_id) do update
    set role = case
      when existing.status = 'active'
        and array_position(array['read_only','manager','co_owner','owner'], existing.role)
          > array_position(array['read_only','manager','co_owner','owner'], excluded.role)
      then existing.role else excluded.role end,
      status = 'active';

  if inv.property_id is not null then
    insert into public.property_members as existing (property_id, user_id, role)
      values (inv.property_id, caller_id, inv.role)
      on conflict (property_id, user_id) do update
      set role = case
        when array_position(array['read_only','manager','co_owner','owner'], existing.role)
          > array_position(array['read_only','manager','co_owner','owner'], excluded.role)
        then existing.role else excluded.role end;
  end if;

  update public.household_invitations set status = 'accepted' where id = invite_id;
  insert into public.activity_log
    (household_id, property_id, user_id, action, entity_type, entity_id, metadata)
    values (inv.household_id, inv.property_id, caller_id, 'Invitation acceptée',
      'invitation', invite_id, jsonb_build_object('role', inv.role));
end;
$$;

revoke all on function nuvabri_security.accept_household_invitation(uuid) from public, anon;
grant execute on function nuvabri_security.accept_household_invitation(uuid) to authenticated;

-- Preserve the existing PostgREST RPC contract; privileged code is in a private schema.
create or replace function public.accept_household_invitation(invite_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select nuvabri_security.accept_household_invitation(invite_id); $$;
revoke all on function public.accept_household_invitation(uuid) from public, anon;
grant execute on function public.accept_household_invitation(uuid) to authenticated;

notify pgrst, 'reload schema';
