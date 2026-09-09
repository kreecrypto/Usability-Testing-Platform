begin;

create table if not exists public.ingestion_token_uses (
  token_id text primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  test_version_id uuid not null references public.test_versions(id) on delete cascade,
  consumed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists ingestion_token_uses_session_consumed_idx
  on public.ingestion_token_uses (session_id, consumed_at desc);

alter table public.ingestion_token_uses enable row level security;
revoke all on table public.ingestion_token_uses from anon, authenticated;

create or replace function public.consume_ingestion_token(
  p_token_id text,
  p_session_id uuid,
  p_test_version_id uuid,
  p_expires_at timestamptz,
  p_rate_limit_per_minute integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if p_rate_limit_per_minute is null or p_rate_limit_per_minute <= 0 then
    raise exception 'invalid_rate_limit';
  end if;

  if p_expires_at <= now() then
    return 'expired';
  end if;

  if exists (select 1 from public.ingestion_token_uses where token_id = p_token_id) then
    return 'replayed';
  end if;

  select count(*) into recent_count
  from public.ingestion_token_uses
  where session_id = p_session_id
    and consumed_at >= now() - interval '1 minute';

  if recent_count >= p_rate_limit_per_minute then
    return 'rate_limited';
  end if;

  begin
    insert into public.ingestion_token_uses(token_id, session_id, test_version_id, expires_at)
    values (p_token_id, p_session_id, p_test_version_id, p_expires_at);
  exception when unique_violation then
    return 'replayed';
  end;

  return 'accepted';
end;
$$;

revoke all on function public.consume_ingestion_token(text, uuid, uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_ingestion_token(text, uuid, uuid, timestamptz, integer) to service_role;

commit;
