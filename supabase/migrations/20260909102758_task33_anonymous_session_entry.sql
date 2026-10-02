-- Task 33: server-only atomic anonymous participant/session entry.
-- Public participants never receive direct database credentials. The Next.js server
-- calls this RPC with SUPABASE_SECRET_KEY, then mints a short-lived session-bound
-- ingestion token using the existing GWD-06 signing contract.

create or replace function public.create_anonymous_participant_session(
  p_test_version_id uuid,
  p_consent_version text,
  p_locale text default null
)
returns table (
  participant_id uuid,
  session_id uuid,
  workspace_id uuid,
  test_id uuid,
  test_version_id uuid,
  started_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version public.test_versions%rowtype;
  v_participant_id uuid;
  v_session_id uuid;
  v_started_at timestamptz;
begin
  if nullif(trim(p_consent_version), '') is null then
    raise exception 'consent_version_required' using errcode = '22023';
  end if;

  select tv.* into v_version
  from public.test_versions tv
  join public.tests t on t.id = tv.test_id
  where tv.id = p_test_version_id
    and tv.lifecycle_status = 'published'
    and t.status = 'published';

  if v_version.id is null then
    raise exception 'published_test_version_not_found' using errcode = '22023';
  end if;

  insert into public.participants (workspace_id, test_id)
  values (v_version.workspace_id, v_version.test_id)
  returning id into v_participant_id;

  insert into public.sessions (
    workspace_id,
    test_version_id,
    participant_id,
    status,
    consent_version,
    consented_at,
    locale
  ) values (
    v_version.workspace_id,
    v_version.id,
    v_participant_id,
    'active',
    trim(p_consent_version),
    now(),
    nullif(trim(coalesce(p_locale, '')), '')
  ) returning id, public.sessions.started_at into v_session_id, v_started_at;

  return query select
    v_participant_id,
    v_session_id,
    v_version.workspace_id,
    v_version.test_id,
    v_version.id,
    v_started_at;
end;
$$;

revoke all on function public.create_anonymous_participant_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_anonymous_participant_session(uuid, text, text) to service_role;

comment on function public.create_anonymous_participant_session(uuid, text, text) is
  'Task33 server-only entry gate. Creates anonymous participant + consented active session atomically for one immutable published test version.';
