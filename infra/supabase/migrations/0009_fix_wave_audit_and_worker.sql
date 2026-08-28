-- Normalize audit actor category separately from the configured actor identifier.
-- Existing migrations are immutable; this migration upgrades deployed PostgreSQL databases.

alter table audit_logs
  add column if not exists actor_id text;

alter table audit_logs
  drop constraint if exists audit_logs_actor_type_check;

update audit_logs
set
  actor_id = coalesce(
    actor_id,
    case actor_type
      when 'SYSTEM' then 'system'
      when 'ANONYMOUS_REVIEWER' then 'demo-operator'
      else actor_type
    end
  ),
  actor_type = case actor_type
    when 'SYSTEM' then 'SYSTEM'
    when 'ANONYMOUS_REVIEWER' then 'INSECURE_DEMO'
    else 'OPERATOR'
  end;

alter table audit_logs
  alter column actor_id set not null,
  add constraint audit_logs_actor_type_check
    check (actor_type in ('SYSTEM', 'OPERATOR', 'INSECURE_DEMO'));

alter table worker_heartbeats
  add column if not exists worker_version text not null default 'unknown';
