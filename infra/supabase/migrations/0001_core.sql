create table if not exists assets (
  id text primary key,
  name text not null,
  asset_type text not null,
  status text not null default 'UNVERIFIED',
  currency text not null,
  token_unit text not null,
  is_synthetic boolean not null default true check (is_synthetic = true),
  created_at timestamptz not null default now()
);

create table if not exists issuance_documents (
  id text primary key,
  asset_id text not null references assets(id),
  file_hash text not null,
  version text not null,
  storage_path text,
  is_synthetic boolean not null default true check (is_synthetic = true),
  uploaded_at timestamptz not null default now()
);

create table if not exists policy_constraints (
  id text primary key,
  asset_id text not null references assets(id),
  document_id text not null references issuance_documents(id),
  field_name text not null,
  normalized_value jsonb not null,
  evidence_span jsonb not null,
  confirmed boolean not null default false,
  is_synthetic boolean not null default true check (is_synthetic = true),
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id text primary key,
  asset_id text not null references assets(id),
  chain_id bigint,
  address text,
  source_hash text not null,
  proxy_status text not null default 'NOT_CHECKED',
  is_synthetic boolean not null default true check (is_synthetic = true),
  created_at timestamptz not null default now()
);

create table if not exists scan_runs (
  id text primary key,
  asset_id text not null references assets(id),
  status text not null,
  input_hashes jsonb not null,
  rule_versions jsonb not null,
  is_synthetic boolean not null default true check (is_synthetic = true),
  started_at timestamptz not null,
  completed_at timestamptz
);

create table if not exists findings (
  id text primary key,
  scan_id text not null references scan_runs(id),
  rule_id text not null,
  severity text not null,
  finding_status text not null,
  title text not null,
  source_hash text not null,
  code_evidence jsonb not null,
  policy_evidence jsonb,
  tool_versions jsonb not null,
  is_synthetic boolean not null default true check (is_synthetic = true)
);

create table if not exists mismatch_findings (
  id text primary key,
  constraint_id text not null references policy_constraints(id),
  finding_id text not null references findings(id),
  implementation_status text not null,
  severity text not null,
  evidence_links jsonb not null,
  is_synthetic boolean not null default true check (is_synthetic = true)
);

create table if not exists onchain_events (
  id bigserial primary key,
  asset_id text not null references assets(id),
  mode text not null check (mode in ('LIVE', 'REPLAY')),
  chain_id bigint not null,
  tx_hash text not null,
  log_index integer not null,
  block_number bigint not null,
  event_name text not null,
  payload jsonb not null,
  fixture_version text,
  is_synthetic boolean not null default true check (is_synthetic = true),
  observed_at timestamptz not null default now(),
  unique (chain_id, tx_hash, log_index)
);

create table if not exists alerts (
  id text primary key,
  asset_id text not null references assets(id),
  alert_type text not null,
  severity text not null,
  status text not null default 'NEW',
  cause jsonb not null,
  evidence_links jsonb not null,
  dedupe_key text not null unique,
  is_synthetic boolean not null default true check (is_synthetic = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key,
  job_type text not null,
  status text not null default 'QUEUED',
  payload jsonb not null,
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_claim
  on jobs (status, available_at, created_at)
  where status = 'QUEUED';

create index if not exists idx_onchain_events_asset_block
  on onchain_events (asset_id, block_number desc);

alter table assets enable row level security;
alter table issuance_documents enable row level security;
alter table policy_constraints enable row level security;
alter table contracts enable row level security;
alter table scan_runs enable row level security;
alter table findings enable row level security;
alter table mismatch_findings enable row level security;
alter table onchain_events enable row level security;
alter table alerts enable row level security;
alter table jobs enable row level security;
