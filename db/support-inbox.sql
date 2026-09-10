-- Additive schema snapshot. Apply once through the existing Supabase migration workflow.
-- No customer seed data, no mailbox provisioning, no modification to existing tables.
create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 provider_email_id uuid unique,
 source text not null check (source in ('email','manual')),
 from_email text not null check (length(from_email) between 3 and 254),
 to_email text,
 subject text not null check (length(subject) between 1 and 240),
 body_text text not null check (length(body_text) between 1 and 20000),
 message_id text,
 attachment_count integer not null default 0 check (attachment_count>=0),
 category text not null default 'other' check (category in ('technical','suggestion','partner','privacy','financial','billing','other')),
 priority text not null default 'normal' check (priority in ('normal','high')),
 sensitive boolean not null default false,
 summary text not null default '' check (length(summary)<=800),
 analysis_source text not null default 'rules' check (analysis_source in ('rules','ai','manual')),
 draft text not null default '' check (length(draft)<=8000),
 status text not null default 'new' check (status in ('new','review','waiting','closed')),
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index support_tickets_created_idx on public.support_tickets(created_at desc,id);
create table public.support_replies (
 id uuid primary key,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),
 from_email text not null,
 to_email text not null,
 subject text not null,
 body_text text not null check(length(body_text) between 1 and 8000),
 message_id text,
 state text not null default 'pending' check(state in ('pending','accepted')),
 provider_id uuid,
 accepted_at timestamptz
);
create index support_replies_ticket_idx on public.support_replies(ticket_id,approved_at desc);
create index support_replies_approved_by_idx on public.support_replies(approved_by);
create unique index support_one_pending_reply on public.support_replies(ticket_id) where state='pending';
create table public.support_generations (
 id uuid primary key,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 model text not null,
 status text not null default 'pending' check(status in ('pending','complete','error')),
 result jsonb,
 usage jsonb,
 estimated_cost_usd numeric,
 created_at timestamptz not null default now()
);
create index support_generations_ticket_idx on public.support_generations(ticket_id,created_at desc);
create index support_generations_user_idx on public.support_generations(user_id);
alter table public.support_tickets enable row level security;
alter table public.support_replies enable row level security;
alter table public.support_generations enable row level security;
revoke all on public.support_tickets, public.support_replies, public.support_generations from anon, authenticated;
grant select,insert,update on public.support_tickets, public.support_replies, public.support_generations to authenticated;
grant select,insert,update on public.support_tickets to service_role;
-- Membership table is already protected: authenticated users can only read their own membership.
create policy support_tickets_admin on public.support_tickets for all to authenticated
 using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
 with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy support_replies_admin on public.support_replies for all to authenticated
 using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
 with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy support_generations_admin on public.support_generations for all to authenticated
 using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
 with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));

-- Atomic approval and outbox reservation. INVOKER retains caller's RLS, including for retries.
create function public.hp_support_prepare_reply(p_ticket uuid,p_revision uuid,p_request uuid,p_text text,p_from text,p_sensitive boolean)
returns public.support_replies language plpgsql security invoker set search_path='' as $$
declare t public.support_tickets; r public.support_replies;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Admin required' using errcode='42501'; end if;
 select * into t from public.support_tickets where id=p_ticket for update;
 if t.id is null then raise exception 'Ticket unavailable' using errcode='P0002'; end if;
 select * into r from public.support_replies where id=p_request;
 if r.id is not null then
   if r.ticket_id<>p_ticket or r.body_text<>p_text or r.from_email<>p_from or r.approved_by<>auth.uid() then raise exception 'Request conflict' using errcode='23505'; end if;
   return r;
 end if;
 if t.revision<>p_revision or t.status='closed' then raise exception 'Stale ticket' using errcode='23505'; end if;
 if t.sensitive and p_sensitive is distinct from true then raise exception 'Sensitive review required' using errcode='42501'; end if;
 if length(trim(p_text)) not between 1 and 8000 or length(p_from) not between 3 and 254 then raise exception 'Invalid reply'; end if;
 insert into public.support_replies(id,ticket_id,approved_by,from_email,to_email,subject,body_text,message_id)
 values(p_request,t.id,auth.uid(),p_from,t.from_email,'Re: '||t.subject,p_text,t.message_id) returning * into r;
 update public.support_tickets set draft=p_text,status='waiting',revision=gen_random_uuid(),updated_at=now() where id=t.id;
 return r;
end $$;
revoke all on function public.hp_support_prepare_reply(uuid,uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.hp_support_prepare_reply(uuid,uuid,uuid,text,text,boolean) to authenticated;
