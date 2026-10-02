create schema if not exists internal;

revoke all on schema internal from public, anon, authenticated;
grant usage on schema internal to service_role;

create table if not exists internal.auto_major_execution_leases (
  major_id text primary key,
  lease_owner text not null,
  run_id text not null,
  leased_at timestamptz not null default now(),
  lease_until timestamptz not null,
  heartbeat_at timestamptz not null default now(),
  constraint auto_major_execution_leases_major_id_check
    check (major_id ~ '^MAJOR-[0-9]{2}$'),
  constraint auto_major_execution_leases_owner_check
    check (length(btrim(lease_owner)) > 0),
  constraint auto_major_execution_leases_run_id_check
    check (length(btrim(run_id)) > 0),
  constraint auto_major_execution_leases_window_check
    check (lease_until > leased_at)
);

revoke all on table internal.auto_major_execution_leases from public, anon, authenticated;
grant select, insert, update, delete on table internal.auto_major_execution_leases to service_role;

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
  if p_major_id !~ '^MAJOR-[0-9]{2}$' then
    raise exception 'invalid major id';
  end if;
  if length(btrim(coalesce(p_lease_owner, ''))) = 0 or length(btrim(coalesce(p_run_id, ''))) = 0 then
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

create or replace function internal.refresh_auto_major_lease(
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
  v_count integer;
  v_seconds integer := greatest(300, least(coalesce(p_lease_seconds, 4500), 7200));
begin
  update internal.auto_major_execution_leases
     set lease_until = now() + make_interval(secs => v_seconds),
         heartbeat_at = now()
   where major_id = p_major_id
     and lease_owner = p_lease_owner
     and run_id = p_run_id
     and lease_until > now();

  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function internal.release_auto_major(
  p_major_id text,
  p_lease_owner text,
  p_run_id text
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, internal
as $$
declare
  v_count integer;
begin
  delete from internal.auto_major_execution_leases
   where major_id = p_major_id
     and lease_owner = p_lease_owner
     and run_id = p_run_id;

  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke execute on function internal.try_claim_auto_major(text,text,text,integer) from public, anon, authenticated;
revoke execute on function internal.refresh_auto_major_lease(text,text,text,integer) from public, anon, authenticated;
revoke execute on function internal.release_auto_major(text,text,text) from public, anon, authenticated;

grant execute on function internal.try_claim_auto_major(text,text,text,integer) to service_role;
grant execute on function internal.refresh_auto_major_lease(text,text,text,integer) to service_role;
grant execute on function internal.release_auto_major(text,text,text) to service_role;
