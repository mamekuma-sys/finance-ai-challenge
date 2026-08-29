-- Report envelope pins the immutable nested EvidenceReport hash.

alter table reports
  add column if not exists report_hash text;
