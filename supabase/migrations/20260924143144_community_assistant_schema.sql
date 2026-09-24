-- ---------------------------------------------------------------------------
-- Community Assistant schema
--
-- Lifts the self-hosted PostgreSQL schema (server/migrations/001_init.sql and
-- 002_organizations.sql in the community-assistant repo) into this project as
-- its own schema. This is the final state of those two files applied in order,
-- so the backfill and the orphan guard rail in 002 are left out: they operated
-- on data that is already stamped in the source database.
--
-- Nothing here touches the public schema. The work order tables, functions,
-- and policies are untouched, and a full rollback is one statement:
--   drop schema community_assistant cascade;
--
-- Community Assistant keeps its own users table and its own authentication.
-- It must never create rows in auth.users: that table carries an after-insert
-- trigger from 20260513120002_invitations.sql that requires a matching
-- invitation and stamps a work order role.
-- ---------------------------------------------------------------------------

create schema if not exists community_assistant;

-- ── application role ────────────────────────────────────────────────────────
-- A dedicated least-privilege login. It can reach this schema and nothing
-- else, so the Express API physically cannot read or write the work order
-- tables. No password here on purpose: set it out of band with
--   alter role community_assistant_app with password '...';
-- so it never lands in a committed file.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'community_assistant_app') then
    create role community_assistant_app with login;
  end if;
end $$;

-- The app builds SQL with unqualified table names, so pin the search path to
-- this schema on the role. That is what lets the Express server move over
-- without a code change. Setting it on the shared postgres role instead would
-- break every unqualified query the work order app makes.
alter role community_assistant_app set search_path = community_assistant;

grant usage on schema community_assistant to community_assistant_app;

-- ── updated_date maintenance ────────────────────────────────────────────────
-- Fires only when the caller did NOT set updated_date explicitly, so a data
-- import can preserve original timestamps while ordinary writes get "now".
-- Lives in this schema rather than public, where it would sit beside the work
-- order set_updated_at and invite a future name collision.
create or replace function community_assistant.set_updated_date() returns trigger as $$
begin
  if new.updated_date is not distinct from old.updated_date then
    new.updated_date := now();
  end if;
  return new;
end;
$$ language plpgsql;

-- ── organizations ───────────────────────────────────────────────────────────
create table community_assistant.organizations (
  id              text        primary key,
  name            text        not null,
  setup_complete  boolean     not null default false,
  plan            text        not null default 'trial'
                                check (plan in ('trial','free','pro','enterprise')),
  status          text        not null default 'active'
                                check (status in ('active','suspended')),
  billing_email   text,
  trial_ends_at   timestamptz,
  settings        jsonb       default '{}'::jsonb,
  -- Founding administrator. No FK: users.organization_id already points back
  -- here, and a mutual FK pair makes both inserts require a deferred cycle.
  owner_user_id   text,
  -- Platform super admin who provisions and manages this organization.
  managed_by      text,
  created_by      text,
  created_date    timestamptz not null default now(),
  updated_date    timestamptz not null default now()
);
create index ix_orgs_owner   on community_assistant.organizations (owner_user_id);
create index ix_orgs_managed on community_assistant.organizations (managed_by);
create index ix_orgs_status  on community_assistant.organizations (status);
create trigger tg_orgs_updated before update on community_assistant.organizations
  for each row execute function community_assistant.set_updated_date();

-- ── users ───────────────────────────────────────────────────────────────────
-- id is TEXT rather than uuid so the original Base44 record ids (24-char hex)
-- stay verbatim and every cross-reference keeps working.
create table community_assistant.users (
  id                  text        primary key,
  email               text        not null unique,
  full_name           text,
  avatar_url          text,
  password_hash       text,                       -- null => Google-only account
  google_sub          text        unique,         -- Google OAuth subject id
  role                text        not null default 'user'
                                    check (role in ('admin','user','super_admin')),
  tenant_id           text,                       -- admin this member belongs to
  organization_id     text,                       -- authoritative tenant key
  widget_permissions  jsonb       default '[]'::jsonb,
  status              text        not null default 'active'
                                    check (status in ('active','deleted')),
  deleted_at          timestamptz,
  deleted_role        text,
  job_title           text,
  phone               text,
  created_by          text,
  created_date        timestamptz not null default now(),
  updated_date        timestamptz not null default now()
);
create index ix_users_tenant on community_assistant.users (tenant_id);
create index ix_users_status on community_assistant.users (status);
create index ix_users_org    on community_assistant.users (organization_id);
create trigger trg_users_updated before update on community_assistant.users
  for each row execute function community_assistant.set_updated_date();

-- ── communities ─────────────────────────────────────────────────────────────
create table community_assistant.communities (
  id                        text        primary key,
  name                      text        not null,
  description               text,
  address                   text,
  phone                     text,
  care_types                jsonb,
  pricing                   jsonb,
  images                    jsonb,
  floor_plans               jsonb,
  amenities                 jsonb,
  faq                       jsonb,
  welcomehome_community_id  bigint,
  ga_property_id            text,
  ga_property_name          text,
  ga_connected_email        text,
  tenant_id                 text,
  organization_id           text,
  created_by                text,
  created_date              timestamptz not null default now(),
  updated_date              timestamptz not null default now()
);
create index ix_communities_tenant     on community_assistant.communities (tenant_id);
create index ix_communities_created_by on community_assistant.communities (created_by);
create index ix_communities_org        on community_assistant.communities (organization_id);
create trigger trg_communities_updated before update on community_assistant.communities
  for each row execute function community_assistant.set_updated_date();

-- ── widgets ─────────────────────────────────────────────────────────────────
create table community_assistant.widgets (
  id                          text        primary key,
  name                        text        not null,
  status                      text        not null default 'draft'
                                            check (status in ('draft','published')),
  nodes                       jsonb,
  settings                    jsonb,
  appearance                  jsonb,
  alerts                      jsonb,
  is_default                  boolean     not null default false,
  welcomehome_community_id    bigint,
  welcomehome_community_name  text,
  tenant_id                   text,
  organization_id             text,
  created_by                  text,
  created_date                timestamptz not null default now(),
  updated_date                timestamptz not null default now()
);
create index ix_widgets_tenant     on community_assistant.widgets (tenant_id);
create index ix_widgets_status     on community_assistant.widgets (status);
create index ix_widgets_created_by on community_assistant.widgets (created_by);
create index ix_widgets_org        on community_assistant.widgets (organization_id);
create trigger trg_widgets_updated before update on community_assistant.widgets
  for each row execute function community_assistant.set_updated_date();

-- ── prospects ───────────────────────────────────────────────────────────────
create table community_assistant.prospects (
  id                       text        primary key,
  first_name               text        not null,
  last_name                text,
  email                    text,
  phone                    text,
  relationship             text check (relationship in ('self','spouse','parent','grandparent','friend','other')),
  care_type_interest       text check (care_type_interest in ('independent_living','assisted_living','memory_care','skilled_nursing')),
  timeline                 text check (timeline in ('immediately','1_3_months','3_6_months','6_12_months','just_researching')),
  budget_qualified         boolean,
  interests                jsonb,
  status                   text        not null default 'new'
                             check (status in ('new','contacted','tour_scheduled','tour_completed','qualified','moved_in','lost')),
  move_in_score            double precision,
  source                   text check (source in ('vsa_tour','vsa_pricing','vsa_chat','website','referral','other')),
  notes                    text,
  community_id             text,        -- widget id the prospect came from
  crm_sync_status          text check (crm_sync_status in ('pending','syncing','synced','updated','failed','not_mapped')),
  crm_sync_error           text,
  welcomehome_prospect_id  bigint,
  sync_initiated           boolean     not null default false,
  tenant_id                text,
  organization_id          text,
  created_by               text,
  created_date             timestamptz not null default now(),
  updated_date             timestamptz not null default now()
);
create index ix_prospects_tenant    on community_assistant.prospects (tenant_id);
create index ix_prospects_community on community_assistant.prospects (community_id);
create index ix_prospects_email     on community_assistant.prospects (email);
create index ix_prospects_phone     on community_assistant.prospects (phone);
create index ix_prospects_sync      on community_assistant.prospects (crm_sync_status);
create index ix_prospects_created   on community_assistant.prospects (created_date desc);
create index ix_prospects_org       on community_assistant.prospects (organization_id);
create trigger trg_prospects_updated before update on community_assistant.prospects
  for each row execute function community_assistant.set_updated_date();

-- ── conversations ───────────────────────────────────────────────────────────
create table community_assistant.conversations (
  id            text        primary key,
  prospect_id   text        not null,
  community_id  text,        -- widget id
  messages      jsonb,
  status        text        not null default 'active'
                              check (status in ('active','closed','pending_response')),
  flow_type     text check (flow_type in ('tour','pricing','general','instant_answer')),
  summary       text,
  tenant_id     text,
  organization_id text,
  created_by    text,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now()
);
create index ix_conversations_tenant    on community_assistant.conversations (tenant_id);
create index ix_conversations_prospect  on community_assistant.conversations (prospect_id);
create index ix_conversations_community on community_assistant.conversations (community_id);
create index ix_conversations_created   on community_assistant.conversations (created_date desc);
create index ix_conversations_org       on community_assistant.conversations (organization_id);
create trigger trg_conversations_updated before update on community_assistant.conversations
  for each row execute function community_assistant.set_updated_date();

-- ── tour_requests ───────────────────────────────────────────────────────────
create table community_assistant.tour_requests (
  id               text        primary key,
  prospect_id      text        not null,
  community_id     text,        -- widget id
  conversation_id  text,
  requested_date   text        not null,   -- free-form date string from the widget
  requested_time   text,
  status           text        not null default 'requested'
                     check (status in ('requested','confirmed','rescheduled','cancelled','completed')),
  confirmed_date   text,
  confirmed_time   text,
  notes            text,
  tenant_id        text,
  organization_id  text,
  created_by       text,
  created_date     timestamptz not null default now(),
  updated_date     timestamptz not null default now()
);
create index ix_tours_tenant    on community_assistant.tour_requests (tenant_id);
create index ix_tours_prospect  on community_assistant.tour_requests (prospect_id);
create index ix_tours_community on community_assistant.tour_requests (community_id);
create index ix_tours_status    on community_assistant.tour_requests (status);
create index ix_tours_org       on community_assistant.tour_requests (organization_id);
create trigger trg_tour_requests_updated before update on community_assistant.tour_requests
  for each row execute function community_assistant.set_updated_date();

-- ── invited_members ─────────────────────────────────────────────────────────
create table community_assistant.invited_members (
  id              text        primary key,
  email           text        not null,
  invited_by      text,
  tenant_id       text,
  organization_id text,
  token           text        unique,
  expires_at      timestamptz,
  status          text        not null default 'invited'
                                check (status in ('invited','accepted','revoked')),
  invited_role    text        not null default 'user'
                                check (invited_role in ('user','admin')),
  created_by      text,
  created_date    timestamptz not null default now(),
  updated_date    timestamptz not null default now()
);
create index ix_invited_email  on community_assistant.invited_members (email);
create index ix_invited_tenant on community_assistant.invited_members (tenant_id);
create index ix_invited_org    on community_assistant.invited_members (organization_id);
create trigger trg_invited_members_updated before update on community_assistant.invited_members
  for each row execute function community_assistant.set_updated_date();

-- ── password_resets ─────────────────────────────────────────────────────────
create table community_assistant.password_resets (
  token        text        primary key,
  user_id      text        not null,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_date timestamptz not null default now()
);
create index ix_pwreset_user on community_assistant.password_resets (user_id);

-- ── schema_migrations ───────────────────────────────────────────────────────
-- The app's own bookkeeping table, from server/scripts/migrate.js. Kept and
-- pre-seeded so that running `npm run migrate` against this database is a
-- no-op instead of replaying 001 and 002 into whatever schema it lands in.
create table community_assistant.schema_migrations (
  name        text        primary key,
  applied_at  timestamptz not null default now()
);
insert into community_assistant.schema_migrations (name) values
  ('001_init.sql'),
  ('002_organizations.sql');

-- ── grants ──────────────────────────────────────────────────────────────────
grant select, insert, update, delete
  on all tables in schema community_assistant
  to community_assistant_app;

alter default privileges in schema community_assistant
  grant select, insert, update, delete on tables to community_assistant_app;

-- anon and authenticated are deliberately not granted anything here, and this
-- schema is not added to the Data API's exposed schemas. The Express API is
-- the only way in, exactly as it is on IONOS today.

-- ── row level security ──────────────────────────────────────────────────────
-- Tenant scoping still lives in the application (Repo.#tenantClause), so the
-- app role gets an unrestricted policy. The point of enabling RLS now is that
-- if this schema is ever exposed to the Data API, or anon/authenticated are
-- ever granted on it by accident, they match no policy and read nothing.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','users','communities','widgets','prospects',
    'conversations','tour_requests','invited_members','password_resets',
    'schema_migrations'
  ] loop
    execute format('alter table community_assistant.%I enable row level security', t);
    execute format(
      'create policy app_full_access on community_assistant.%I '
      'for all to community_assistant_app using (true) with check (true)', t);
  end loop;
end $$;
