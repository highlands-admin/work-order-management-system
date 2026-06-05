-- Restrict public (un-invited) signup to the organization's email domain
-- (@highlands.care). Invited users are exempt: an administrator has already
-- vetted them, so an invitation for any domain still works and takes precedence.
-- Enforcing this in the trigger means the form cannot be bypassed.

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
    -- Open signup is limited to the organization domain.
    if lower(new.email) not like '%@highlands.care' then
      raise exception 'Public signup is restricted to @highlands.care email addresses.'
        using errcode = 'check_violation';
    end if;

    insert into public.user_roles (user_id, role)
    values (new.id, 'requester');
  end if;

  return new;
end;
$$;
