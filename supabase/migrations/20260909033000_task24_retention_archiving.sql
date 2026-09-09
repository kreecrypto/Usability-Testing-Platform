-- Task 24: Event indexing, retention, and expiry propagation.
-- Planning acceptance:
-- 1) indexes support session/task queries
-- 2) raw session/event/answer retention defaults to 90 days after session completion
-- 3) retention expiry removes raw + derived evidence that can reconstruct a session
-- Source: docs/privacy-baseline.md + Task List row 46.

-- Session/task query paths used by session detail and task-level analytics.
create index if not exists events_session_task_occurred_idx
  on public.events (session_id, task_id, occurred_at, received_at);

create index if not exists answers_session_task_created_idx
  on public.answers (session_id, task_id, created_at);

-- Expiry scan and finding-evidence cleanup paths.
create index if not exists sessions_delete_after_idx
  on public.sessions (delete_after)
  where delete_after is not null;

create index if not exists finding_evidence_session_idx
  on public.finding_evidence (session_id)
  where session_id is not null;

create index if not exists finding_evidence_event_idx
  on public.finding_evidence (event_id)
  where event_id is not null;

create index if not exists finding_evidence_answer_idx
  on public.finding_evidence (answer_id)
  where answer_id is not null;

-- Preserve an explicit workspace override when delete_after is already supplied.
-- Otherwise, once completed_at exists, the V1 default is 90 days after completion.
create or replace function private.set_default_session_delete_after()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.completed_at is not null and new.delete_after is null then
    new.delete_after := new.completed_at + interval '90 days';
  end if;
  return new;
end;
$$;

revoke all on function private.set_default_session_delete_after() from public, anon, authenticated;
grant execute on function private.set_default_session_delete_after() to service_role;

drop trigger if exists sessions_default_delete_after on public.sessions;
create trigger sessions_default_delete_after
before insert or update of completed_at, delete_after
on public.sessions
for each row
execute function private.set_default_session_delete_after();

-- Backfill only rows that already have an authoritative completion timestamp.
-- No completion timestamp is invented for abandoned/technical-blocked sessions.
update public.sessions
set delete_after = completed_at + interval '90 days'
where completed_at is not null
  and delete_after is null;

-- Expiry is intentionally server-only. The function first removes evidence rows
-- that could reconstruct the expiring session, then deletes the session. Existing
-- ON DELETE CASCADE relationships remove task_sessions/events/answers. Findings
-- remain as research records but no longer retain the deleted session evidence.
create or replace function private.purge_expired_sessions(
  cutoff timestamptz default now(),
  max_rows integer default 500
)
returns table (session_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_session_id uuid;
begin
  if max_rows is null or max_rows < 1 or max_rows > 5000 then
    raise exception 'max_rows must be between 1 and 5000';
  end if;

  for target_session_id in
    select s.id
    from public.sessions s
    where s.delete_after is not null
      and s.delete_after <= cutoff
    order by s.delete_after, s.id
    for update skip locked
    limit max_rows
  loop
    delete from public.finding_evidence fe
    where fe.session_id = target_session_id
       or fe.event_id in (
         select e.event_id
         from public.events e
         where e.session_id = target_session_id
       )
       or fe.answer_id in (
         select a.id
         from public.answers a
         where a.session_id = target_session_id
       );

    delete from public.sessions s
    where s.id = target_session_id;

    session_id := target_session_id;
    return next;
  end loop;
end;
$$;

revoke all on function private.purge_expired_sessions(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function private.purge_expired_sessions(timestamptz, integer)
  to service_role;
