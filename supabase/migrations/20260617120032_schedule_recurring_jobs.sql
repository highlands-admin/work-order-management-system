-- Schedule the recurrence jobs with pg_cron, and trigger reminder emails with
-- pg_net. Generation is pure SQL and runs in the database. Reminders need the
-- Resend email layer, which lives in the Next.js app, so the reminder job posts
-- to a protected route that sends the mail.
--
-- pg_cron has no access to environment variables, so the app URL and the shared
-- secret are read from Supabase Vault. After applying this migration, set them
-- once (values are not committed):
--
--   select vault.create_secret('https://your-app.example.com', 'recurrence_app_url');
--   select vault.create_secret('<a long random string>',        'recurrence_cron_secret');
--
-- The same secret must be set as CRON_SECRET in the app's environment so the
-- route can verify the caller.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Post to the reminder route with the shared secret as a bearer token. No-ops
-- with a notice if the Vault secrets have not been configured yet, so the job
-- never errors on a fresh deployment.
create or replace function public.trigger_recurrence_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_url text;
  v_secret  text;
begin
  select decrypted_secret into v_app_url
  from vault.decrypted_secrets
  where name = 'recurrence_app_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'recurrence_cron_secret';

  if v_app_url is null or v_secret is null then
    raise notice 'Recurrence reminder secrets not configured; skipping.';
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_app_url, '/') || '/api/cron/recurrence-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.trigger_recurrence_reminders() from public;

-- Both jobs run daily at 14:00 UTC, which is 09:00 America/New_York during
-- standard time (EST, UTC-5). pg_cron runs in UTC and classic cron has no
-- per-job timezone, so this is fixed to EST. During US daylight time the jobs
-- land at 10:00 local; change both to '0 13 * * *' if you prefer 09:00 EDT.
--
-- Running both at the same time is safe: every occurrence is created either
-- inline when its recurring order is filed, or up to generation_lead_days (30)
-- ahead, so the reminder job never depends on a same-tick generation run.

-- Generate due occurrences.
select cron.schedule(
  'generate-recurring-work-orders',
  '0 14 * * *',
  $$select public.generate_due_recurring_work_orders()$$
);

-- Send reminder emails.
select cron.schedule(
  'send-recurrence-reminders',
  '0 14 * * *',
  $$select public.trigger_recurrence_reminders()$$
);
