-- Task 3 immutable scan result snapshot used by scan/report/dashboard reads.

alter table scan_runs
  add column if not exists result_payload jsonb not null default '{}'::jsonb;

alter table issuance_documents
  add column if not exists extraction_metadata jsonb not null default '{}'::jsonb;
