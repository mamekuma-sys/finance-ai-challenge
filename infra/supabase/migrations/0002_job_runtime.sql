-- 항목 6 — DB 엔터티와 job 상태 전이
-- 계약: docs/project/b-track-contract.md §2
-- 0001_core.sql의 10개 테이블은 그대로 두고, 갈 곳이 없던 것만 추가한다.

-- 1) ScanRun.failed_stages
-- contracts/VERSION 0.2.0에서 계약에는 들어갔으나 컬럼이 없었다.
-- status='PARTIAL'이면 최소 1건이 있어야 한다는 규칙은 Pydantic과 JSON Schema가 강제한다.
alter table scan_runs
  add column if not exists failed_stages jsonb not null default '[]'::jsonb;

-- 2) job lease
-- worker가 죽어도 5분 뒤 다른 worker가 회수할 수 있어야 한다.
alter table jobs
  add column if not exists lease_expires_at timestamptz,
  add column if not exists max_attempts integer not null default 3;

create index if not exists idx_jobs_reclaim
  on jobs (lease_expires_at)
  where status = 'RUNNING';

-- 3) audit_log
-- FR-02가 통제조건 수정 전후 값을 요구하는데 저장할 곳이 없었다.
create table if not exists audit_log (
  id bigserial primary key,
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_entity
  on audit_log (entity_type, entity_id, created_at desc);

-- 4) evidence_reports
-- GET /v1/reports/{id}가 읽을 immutable snapshot 저장소.
-- payload는 생성 시점의 EvidenceReport 전체이며 이후 수정하지 않는다.
create table if not exists evidence_reports (
  id text primary key,
  scan_id text not null references scan_runs(id),
  asset_id text not null references assets(id),
  contracts_version text not null,
  payload jsonb not null,
  lineage jsonb not null,
  is_synthetic boolean not null default true check (is_synthetic = true),
  generated_at timestamptz not null default now()
);

create index if not exists idx_evidence_reports_scan
  on evidence_reports (scan_id, generated_at desc);

-- 5) chain_cursors (D 소유)
-- 아키텍처 문서 §4.2가 참조하지만 테이블이 없었다. 테이블만 만들고 로직은 D가 채운다.
create table if not exists chain_cursors (
  chain_id bigint not null,
  contract_address text not null,
  last_block bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (chain_id, contract_address)
);

-- 6) risk_snapshots (D 소유)
create table if not exists risk_snapshots (
  id bigserial primary key,
  asset_id text not null references assets(id),
  scan_id text references scan_runs(id),
  exploit_risk integer check (exploit_risk between 0 and 100),
  price_risk integer check (price_risk between 0 and 100),
  components jsonb not null default '{}'::jsonb,
  is_synthetic boolean not null default true check (is_synthetic = true),
  calculated_at timestamptz not null default now()
);

create index if not exists idx_risk_snapshots_asset
  on risk_snapshots (asset_id, calculated_at desc);

alter table audit_log enable row level security;
alter table evidence_reports enable row level security;
alter table chain_cursors enable row level security;
alter table risk_snapshots enable row level security;
