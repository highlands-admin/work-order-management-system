-- Invitations table + signup trigger.
-- A new auth.users row is only allowed if a matching pending invitation exists.
-- The trigger assigns the invitation's role and marks the invitation accepted.

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        public.app_role not null,
  first_name  text,
  last_name   text,
  invited_by  uuid references auth.users(id) on delete set null,
  token       text not null unique,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index invitations_token_idx
  on public.invitations (token);

create index invitations_email_active_idx
  on public.invitations (lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.invitations enable row level security;

-- Only administrators read or write invitations through the app.
-- The accept-invite flow looks up invitations via a SECURITY DEFINER function below,
-- so anonymous and authenticated users do not need any RLS access here.
create policy "Admins manage invitations"
  on public.invitations
  for all
  using (public.current_user_role() = 'administrator')
  with check (public.current_user_role() = 'administrator');

-- Public lookup function for the accept-invite page.
-- Returns the email + role + names for a valid token, or null. Does NOT expose
-- the full invitations table.
create or replace function public.invitation_by_token(p_token text)
returns table (
  email      text,
  role       public.app_role,
  first_name text,
  last_name  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.email, i.role, i.first_name, i.last_name
  from public.invitations i
  where i.token = p_token
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  limit 1;
$$;

revoke execute on function public.invitation_by_token(text) from public;
grant  execute on function public.invitation_by_token(text) to anon, authenticated;

-- Signup trigger: on auth.users insert, require a valid invitation matching the new
-- user's email. Assigns the invitation's role and marks it accepted.
-- Raising an exception aborts the signUp(), which is the gate that closes public signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.invitations%rowtype;
begin
  select * into invite
  from public.invitations
  where lower(email) = lower(new.email)
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'No valid invitation found for %. Signup requires an invitation.', new.email
      using errcode = 'check_violation';
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, invite.role);

  update public.invitations
  set accepted_at = now()
  where id = invite.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
