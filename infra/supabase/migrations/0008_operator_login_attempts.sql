-- Opaque, database-backed operator unlock rate limiting.
-- Raw IP addresses, user agents, and access codes are never persisted.

create table if not exists operator_login_attempts (
  fingerprint text primary key,
  window_started_at timestamptz not null default now(),
  failures integer not null default 0 check (failures between 0 and 5),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
