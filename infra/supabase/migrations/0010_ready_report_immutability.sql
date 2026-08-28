-- EvidenceReport snapshots become immutable once their report row is READY.
-- QUEUED/FAILED rows may still be completed by a worker in a single transition.

create or replace function reject_ready_report_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'READY' then
    raise exception 'READY report is immutable'
      using errcode = '23000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_ready_immutable on reports;

create trigger reports_ready_immutable
before update or delete on reports
for each row
execute function reject_ready_report_mutation();
