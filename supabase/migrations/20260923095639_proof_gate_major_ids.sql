-- Expand MAJOR lease IDs for the proof-gate execution model.
-- Existing numeric MAJOR IDs remain valid; MAJOR-A/B/C are new release proof gates.

alter table internal.auto_major_execution_leases
  drop constraint if exists auto_major_execution_leases_major_id_check;

alter table internal.auto_major_execution_leases
  add constraint auto_major_execution_leases_major_id_check
  check (major_id ~ '^MAJOR-([0-9]{2}|[A-C])$');

create or replace function internal.try_claim_auto_major(
  p_major_id text,
  p_lease_owner text,
  p_run_id text,
  p_lease_seconds integer default 4500
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, internal
as $$
declare
  v_major_id text;
  v_seconds integer := greatest(300, least(coalesce(p_lease_seconds, 4500), 7200));
begin
  if p_major_id !~ '^MAJOR-([0-9]{2}|[A-C])$' then
    raise exception 'invalid major id';
  end if;

  if length(btrim(coalesce(p_lease_owner, ''))) = 0
     or length(btrim(coalesce(p_run_id, ''))) = 0 then
    raise exception 'lease owner and run id are required';
  end if;

  insert into internal.auto_major_execution_leases (
    major_id, lease_owner, run_id, leased_at, lease_until, heartbeat_at
  )
  values (
    p_major_id, p_lease_owner, p_run_id, now(), now() + make_interval(secs => v_seconds), now()
  )
  on conflict (major_id) do update
    set lease_owner = excluded.lease_owner,
        run_id = excluded.run_id,
        leased_at = excluded.leased_at,
        lease_until = excluded.lease_until,
        heartbeat_at = excluded.heartbeat_at
  where internal.auto_major_execution_leases.lease_until <= now()
     or (
       internal.auto_major_execution_leases.lease_owner = excluded.lease_owner
       and internal.auto_major_execution_leases.run_id = excluded.run_id
     )
  returning major_id into v_major_id;

  return v_major_id is not null;
end;
$$;

revoke execute on function internal.try_claim_auto_major(text,text,text,integer)
  from public, anon, authenticated;
grant execute on function internal.try_claim_auto_major(text,text,text,integer)
  to service_role;
