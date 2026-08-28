-- Task 6 trusted mutation auditing and optimistic policy versions.

alter table policy_constraints
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

alter table audit_logs
  add column if not exists metadata jsonb not null default '{}'::jsonb;
