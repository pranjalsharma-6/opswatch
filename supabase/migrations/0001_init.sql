-- OpsWatch schema.
-- Run in the Supabase SQL editor for a new project.

create table if not exists incidents (
  id           uuid primary key default gen_random_uuid(),
  incident_no  text        not null unique,
  severity     text        not null check (severity in ('critical', 'warning', 'info')),
  title        text        not null,
  root_cause   text,
  impact       text,
  fix          text,
  component    text,
  status       text        not null default 'open'
                           check (status in ('open', 'in-progress', 'resolved')),
  log_snippet  text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- incident_no comes from a sequence rather than a client-side row count.
-- Counting rows in the browser raced: two concurrent saves both read the same
-- count and produced duplicate numbers.
create sequence if not exists incident_no_seq owned by none;

alter table incidents
  alter column incident_no
  set default 'INC-' || lpad(nextval('incident_no_seq')::text, 3, '0');

create index if not exists incidents_created_at_idx on incidents (created_at desc);
create index if not exists incidents_status_idx     on incidents (status);
create index if not exists incidents_severity_idx   on incidents (severity);

-- Row level security ---------------------------------------------------------
-- The anon key is shipped to the browser, so any policy permissive enough for
-- direct client writes is equally open to anyone reading the page source. All
-- access goes through the app's route handlers using the service-role key,
-- which bypasses RLS, so no anon policy is granted at all.

alter table incidents enable row level security;

drop policy if exists "Allow all" on incidents;

-- Optional: uncomment to let anyone READ incidents (writes stay server-only).
-- create policy "Public read" on incidents for select to anon using (true);
