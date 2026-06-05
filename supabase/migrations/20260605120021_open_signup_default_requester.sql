-- Allow direct (un-invited) signup. The signup trigger previously aborted any
-- signup without a matching invitation; now a user without an invitation is
-- assigned the default 'requester' role. Invitations still take precedence, so
-- invited administrators, technicians, and inspectors keep their assigned role
-- and their invitation is marked accepted.

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

  if found then
    insert into public.user_roles (user_id, role)
    values (new.id, invite.role);

    update public.invitations
    set accepted_at = now()
    where id = invite.id;
  else
    -- No invitation: open signup defaults to the requester role.
    insert into public.user_roles (user_id, role)
    values (new.id, 'requester');
  end if;

  return new;
end;
$$;
