-- Task 6 alert review memo persistence.

alter table alerts
  add column if not exists memo text;
