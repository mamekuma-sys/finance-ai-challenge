-- P0 workflow persistence. Store synthetic fixtures and sanitized technical metadata only.
-- Do not place personal data, real financial records, or raw user identifiers in these tables.

alter table assets
  add column if not exists underlying_description text not null default 'synthetic fixture',
  add column if not exists total_planned_supply bigint not null default 1
    check (total_planned_supply > 0),
  add column if not exists network text not null default 'KAIA_KAIROS';

alter table issuance_documents
  add column if not exists status text not null default 'UPLOADED'
    check (status in ('UPLOADED', 'PROCESSING', 'READY', 'PARTIAL', 'FAILED')),
  add column if not exists media_type text not null default 'application/pdf',
  add column if not exists size_bytes bigint not null default 0 check (size_bytes >= 0),
  add column if not exists page_count integer check (page_count > 0),
  add column if not exists failed_pages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(failed_pages) = 'array'),
  add column if not exists error_code text,
  add column if not exists processed_at timestamptz;

alter table contracts
  add column if not exists source_kind text not null default 'ADDRESS'
    check (source_kind in ('SOURCE', 'ADDRESS', 'SOURCE_AND_ADDRESS')),
  add column if not exists source_code text;

alter table scan_runs
  add column if not exists contract_id text references contracts(id),
  add column if not exists failed_stages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(failed_stages) = 'array');

alter table jobs
  add column if not exists is_synthetic boolean not null default true
    check (is_synthetic = true);

create table if not exists reports (
  id text primary key,
  asset_id text not null references assets(id),
  scan_id text not null unique references scan_runs(id),
  status text not null check (status in ('QUEUED', 'READY', 'FAILED')),
  evidence jsonb,
  downloads jsonb not null default '{}'::jsonb
    check (jsonb_typeof(downloads) = 'object'),
  limitations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(limitations) = 'array'),
  error_code text,
  is_synthetic boolean not null default true check (is_synthetic = true),
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  asset_id text references assets(id),
  actor_type text not null check (actor_type in ('SYSTEM', 'ANONYMOUS_REVIEWER')),
  action text not null,
  target_type text not null,
  target_id text not null,
  before_state jsonb,
  after_state jsonb,
  is_synthetic boolean not null default true check (is_synthetic = true),
  created_at timestamptz not null default now()
);

create table if not exists worker_heartbeats (
  worker_name text primary key,
  status text not null check (status in ('STARTING', 'READY', 'DEGRADED', 'STOPPING')),
  capabilities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(capabilities) = 'array'),
  last_seen_at timestamptz not null,
  is_synthetic boolean not null default true check (is_synthetic = true),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_asset_status
  on issuance_documents (asset_id, status, uploaded_at desc);

create index if not exists idx_contracts_asset_created
  on contracts (asset_id, created_at desc);

create index if not exists idx_scan_runs_asset_started
  on scan_runs (asset_id, started_at desc);

create index if not exists idx_scan_runs_contract_started
  on scan_runs (contract_id, started_at desc);

create index if not exists idx_reports_asset_created
  on reports (asset_id, created_at desc);

create index if not exists idx_alerts_asset_status_created
  on alerts (asset_id, status, created_at desc);

create index if not exists idx_audit_logs_target_created
  on audit_logs (target_type, target_id, created_at desc);

create index if not exists idx_worker_heartbeats_last_seen
  on worker_heartbeats (last_seen_at);

alter table reports enable row level security;
alter table audit_logs enable row level security;
alter table worker_heartbeats enable row level security;
