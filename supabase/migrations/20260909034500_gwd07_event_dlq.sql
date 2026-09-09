-- GWD-07: durable poison-event monitoring after bounded collector retries.
create table public.event_ingestion_dlq (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  session_id uuid not null,
  event_id uuid not null,
  idempotency_key text not null,
  event_name text not null,
  attempt_count integer not null check (attempt_count > 0),
  failure_code text not null,
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);

create index event_ingestion_dlq_unresolved_idx
  on public.event_ingestion_dlq (last_failed_at desc)
  where resolved_at is null;

alter table public.event_ingestion_dlq enable row level security;

-- The collector uses the server-only service role. Browser roles must not read/write DLQ rows.
revoke all on table public.event_ingestion_dlq from anon, authenticated;
grant select, insert, update, delete on table public.event_ingestion_dlq to service_role;
grant usage, select on sequence public.event_ingestion_dlq_id_seq to service_role;
