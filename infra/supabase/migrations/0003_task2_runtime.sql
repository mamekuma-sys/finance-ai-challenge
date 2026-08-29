-- Task 2 API and worker runtime fields. All rows remain synthetic-only.

alter table alerts
  add column if not exists evidence_mode text not null default 'REPLAY'
    check (evidence_mode in ('LIVE', 'REPLAY')),
  add column if not exists fixture_version text;

alter table jobs
  add column if not exists max_attempts integer not null default 3
    check (max_attempts > 0),
  add column if not exists lease_token text;

create index if not exists idx_jobs_locked
  on jobs (status, locked_at)
  where status = 'RUNNING';
