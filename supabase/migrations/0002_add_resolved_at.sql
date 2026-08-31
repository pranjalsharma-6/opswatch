-- Migration for databases created before resolved_at existed.
-- Safe to run repeatedly.

alter table incidents add column if not exists resolved_at timestamptz;

create sequence if not exists incident_no_seq owned by none;

-- Start the sequence past any numbers already assigned by the old client-side
-- counter so the new default cannot collide with existing rows.
select setval(
  'incident_no_seq',
  greatest(
    coalesce((select max(nullif(regexp_replace(incident_no, '\D', '', 'g'), '')::bigint) from incidents), 0),
    1
  )
);

alter table incidents
  alter column incident_no
  set default 'INC-' || lpad(nextval('incident_no_seq')::text, 3, '0');

alter table incidents enable row level security;
drop policy if exists "Allow all" on incidents;
