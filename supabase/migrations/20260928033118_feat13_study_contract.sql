-- FEAT-13.01: additive, version-scoped research-method contract.
-- Existing usability studies retain their target/task/answer behavior.

alter table public.test_versions
  add column study_mode text not null default 'usability'
  check (study_mode in ('usability', 'methods', 'mixed'));
alter table public.test_versions
  add column screener_config jsonb not null default '{"questions":[]}'::jsonb
    check (jsonb_typeof(screener_config) = 'object' and jsonb_typeof(screener_config -> 'questions') = 'array'),
  add column invite_only boolean not null default false;

create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  test_version_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  kind text not null check (kind in ('usability_task', 'survey', 'card_sort', 'tree_test')),
  task_id uuid,
  title text not null check (length(trim(title)) > 0),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_version_id, ordinal),
  unique (workspace_id, test_version_id, id),
  foreign key (workspace_id, test_version_id)
    references public.test_versions (workspace_id, id) on delete cascade,
  foreign key (workspace_id, test_version_id, task_id)
    references public.tasks (workspace_id, test_version_id, id),
  check ((kind = 'usability_task') = (task_id is not null))
);

create table public.study_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  test_version_id uuid not null,
  session_id uuid not null,
  block_id uuid not null,
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  started_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_id, block_id),
  foreign key (workspace_id, test_version_id, block_id)
    references public.study_blocks (workspace_id, test_version_id, id),
  foreign key (workspace_id, session_id)
    references public.sessions (workspace_id, id) on delete cascade,
  check (submitted_at >= started_at)
);

-- A response must refer to the exact published version of its session.
alter table public.sessions
  add constraint sessions_workspace_id_version_uq
  unique (workspace_id, id, test_version_id);
alter table public.study_responses
  add constraint study_responses_session_version_fk
  foreign key (workspace_id, session_id, test_version_id)
  references public.sessions (workspace_id, id, test_version_id) on delete cascade;

create index study_blocks_workspace_version_idx
  on public.study_blocks (workspace_id, test_version_id, ordinal);
create index study_responses_workspace_version_idx
  on public.study_responses (workspace_id, test_version_id, block_id);
create index study_responses_session_idx
  on public.study_responses (session_id, submitted_at);

alter table public.study_blocks enable row level security;
alter table public.study_blocks force row level security;
alter table public.study_responses enable row level security;
alter table public.study_responses force row level security;
revoke all on public.study_blocks, public.study_responses from public, anon, authenticated;
grant select, insert, update, delete on public.study_blocks to authenticated;
grant select on public.study_responses to authenticated;
grant all on public.study_blocks, public.study_responses to service_role;

create policy study_blocks_select_member on public.study_blocks
  for select to authenticated using (private.is_workspace_member(workspace_id));
create policy study_blocks_insert_editor on public.study_blocks
  for insert to authenticated with check (private.is_research_editor(workspace_id));
create policy study_blocks_update_editor on public.study_blocks
  for update to authenticated
  using (private.is_research_editor(workspace_id))
  with check (private.is_research_editor(workspace_id));
create policy study_blocks_delete_editor on public.study_blocks
  for delete to authenticated using (private.is_research_editor(workspace_id));
create policy study_responses_select_sensitive on public.study_responses
  for select to authenticated using (private.can_read_sensitive_workspace(workspace_id));

create or replace function private.guard_study_block_version_immutable()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select lifecycle_status into v_status from public.test_versions where id = old.test_version_id for share;
    if v_status = 'published' then
      raise exception 'published_study_blocks_are_immutable' using errcode = '55000';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select lifecycle_status into v_status from public.test_versions where id = new.test_version_id for share;
    if v_status = 'published' then
      raise exception 'published_study_blocks_are_immutable' using errcode = '55000';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.guard_study_block_version_immutable() from public, anon, authenticated, service_role;
create trigger study_blocks_published_immutable_trg
before insert or update or delete on public.study_blocks
for each row execute function private.guard_study_block_version_immutable();

create or replace function private.guard_study_response_context()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_session_status text;
  v_version_status text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'study_responses_are_immutable' using errcode = '55000';
  end if;
  select s.status, tv.lifecycle_status into v_session_status, v_version_status
  from public.sessions s
  join public.test_versions tv on tv.id = s.test_version_id
  where s.id = new.session_id and s.workspace_id = new.workspace_id
    and s.test_version_id = new.test_version_id
  for share of s, tv;
  if v_session_status is distinct from 'active' or v_version_status is distinct from 'published' then
    raise exception 'active_published_session_required' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_study_response_context() from public, anon, authenticated, service_role;
create trigger study_responses_context_trg before insert or update on public.study_responses
for each row execute function private.guard_study_response_context();

alter table public.test_versions drop constraint if exists test_versions_published_snapshot_ck;
alter table public.test_versions add constraint test_versions_published_snapshot_ck check (
  lifecycle_status <> 'published' or (
    published_at is not null and (
      study_mode = 'methods' or (
        target_provider is not null and target_snapshot is not null
        and target_snapshot ->> 'provider' = target_provider
      )
    )
  )
);

-- Keep the existing target/rule gate for usability studies. Method-only studies
-- publish without a target, but require at least one method block.
create or replace function public.publish_draft_test_version(p_test_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_version public.test_versions%rowtype;
  v_task_count integer;
  v_block_count integer;
  v_invalid_rule_count integer;
  v_has_v2_rules boolean;
  v_block public.study_blocks%rowtype;
  v_screener_question jsonb;
begin
  perform 1 from public.tests where id = p_test_id for update;
  if not found then
    raise exception 'test_not_found_or_permission_denied' using errcode = '42501';
  end if;

  select * into v_version from public.test_versions
  where test_id = p_test_id and lifecycle_status = 'draft'
  order by version_no desc limit 1 for update;
  if v_version.id is null then
    raise exception 'draft_test_version_required' using errcode = '22023';
  end if;

  select count(*) into v_block_count from public.study_blocks
  where test_version_id = v_version.id and kind <> 'usability_task';
  if v_version.study_mode in ('methods', 'mixed') and v_block_count = 0 then
    raise exception 'at_least_one_method_block_required' using errcode = '22023';
  end if;
  if v_version.study_mode in ('methods', 'mixed') then
    for v_block in select * from public.study_blocks
      where test_version_id = v_version.id and kind <> 'usability_task' loop
      if (v_block.kind = 'survey' and (jsonb_typeof(v_block.config -> 'questions') is distinct from 'array'
          or jsonb_array_length(coalesce(v_block.config -> 'questions', '[]'::jsonb)) = 0))
        or (v_block.kind = 'card_sort' and (v_block.config ->> 'mode' not in ('open', 'closed')
          or jsonb_typeof(v_block.config -> 'cards') is distinct from 'array'
          or jsonb_array_length(coalesce(v_block.config -> 'cards', '[]'::jsonb)) = 0))
        or (v_block.kind = 'tree_test' and (jsonb_typeof(v_block.config -> 'nodes') is distinct from 'array'
          or jsonb_typeof(v_block.config -> 'prompts') is distinct from 'array'
          or jsonb_array_length(coalesce(v_block.config -> 'nodes', '[]'::jsonb)) = 0
          or jsonb_array_length(coalesce(v_block.config -> 'prompts', '[]'::jsonb)) = 0)) then
        raise exception 'invalid_method_block_config' using errcode = '22023';
      end if;
    end loop;
    for v_screener_question in select value from jsonb_array_elements(v_version.screener_config -> 'questions') loop
      if nullif(trim(v_screener_question ->> 'id'), '') is null
        or jsonb_typeof(v_screener_question -> 'options') is distinct from 'array'
        or jsonb_typeof(v_screener_question -> 'accept') is distinct from 'array'
        or jsonb_array_length(coalesce(v_screener_question -> 'options', '[]'::jsonb)) < 2
        or jsonb_array_length(coalesce(v_screener_question -> 'accept', '[]'::jsonb)) = 0 then
        raise exception 'invalid_screener_config' using errcode = '22023';
      end if;
    end loop;
  end if;

  if v_version.study_mode in ('usability', 'mixed') then
    if v_version.target_provider is null
      or v_version.target_snapshot is null
      or v_version.target_snapshot ->> 'provider' is distinct from v_version.target_provider
      or nullif(trim(v_version.target_snapshot ->> 'sourceUrl'), '') is null then
      raise exception 'publishable_target_snapshot_required' using errcode = '22023';
    end if;
    if coalesce((v_version.target_snapshot #>> '{capabilities,publishBlocked}')::boolean, false)
      or v_version.target_snapshot ->> 'launchMode' = 'unsupported' then
      raise exception 'target_preflight_required' using errcode = '22023';
    end if;
    select count(*) into v_task_count from public.tasks where test_version_id = v_version.id;
    if v_task_count = 0 then
      raise exception 'at_least_one_task_required' using errcode = '22023';
    end if;
    select count(*) into v_invalid_rule_count from public.tasks t
    where t.test_version_id = v_version.id and (
      not private.task_rule_publishable(t.success_rule, v_version.target_snapshot)
      or not private.task_rule_publishable(t.failure_rule, v_version.target_snapshot)
      or private.task_rules_conflict(t.success_rule, t.failure_rule)
    );
    if v_invalid_rule_count > 0 then
      raise exception 'publishable_task_rules_required' using errcode = '22023';
    end if;
    select exists (select 1 from public.tasks t where t.test_version_id = v_version.id
      and (t.success_rule ->> 'version' = '2' or t.failure_rule ->> 'version' = '2'))
      into v_has_v2_rules;
  end if;

  update public.test_versions set
    lifecycle_status = 'published', published_at = now(), figma_version_id = null,
    success_rule_version = case when v_has_v2_rules then 'task-outcome-v2'
      else coalesce(success_rule_version, 'task-outcome-v1') end,
    failure_rule_version = case when v_has_v2_rules then 'task-outcome-v2'
      else coalesce(failure_rule_version, 'task-outcome-v1') end,
    abandonment_policy_version = coalesce(abandonment_policy_version, 'abandonment-v1')
  where id = v_version.id;
  update public.tests set status = 'published', updated_at = now() where id = p_test_id;
  return v_version.id;
end;
$$;
revoke all on function public.publish_draft_test_version(uuid) from public, anon;
grant execute on function public.publish_draft_test_version(uuid) to authenticated, service_role;

create or replace function public.create_draft_from_published(p_test_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_existing_draft uuid;
  v_source public.test_versions%rowtype;
  v_new_version_id uuid;
  v_next_version integer;
begin
  perform 1 from public.tests where id = p_test_id for update;
  if not found then raise exception 'test_not_found_or_permission_denied' using errcode = '42501'; end if;
  select id into v_existing_draft from public.test_versions
    where test_id = p_test_id and lifecycle_status = 'draft'
    order by version_no desc limit 1;
  if v_existing_draft is not null then return v_existing_draft; end if;
  select * into v_source from public.test_versions
    where test_id = p_test_id and lifecycle_status = 'published'
    order by version_no desc limit 1;
  if v_source.id is null then raise exception 'published_test_version_required' using errcode = '22023'; end if;
  select coalesce(max(version_no), 0) + 1 into v_next_version
    from public.test_versions where test_id = p_test_id;
  insert into public.test_versions (
    workspace_id, test_id, version_no, lifecycle_status, provider,
    figma_file_key, figma_version_id, figma_start_node_id, prototype_mapping,
    target_provider, target_snapshot, event_schema_version, success_rule_version,
    failure_rule_version, timeout_seconds, abandonment_policy_version,
    funnel_config, study_mode, screener_config, invite_only, created_by
  ) values (
    v_source.workspace_id, v_source.test_id, v_next_version, 'draft', v_source.provider,
    v_source.figma_file_key, null, v_source.figma_start_node_id, v_source.prototype_mapping,
    v_source.target_provider, v_source.target_snapshot, v_source.event_schema_version,
    v_source.success_rule_version, v_source.failure_rule_version,
    v_source.timeout_seconds, v_source.abandonment_policy_version,
    v_source.funnel_config, v_source.study_mode, v_source.screener_config,
    v_source.invite_only, auth.uid()
  ) returning id into v_new_version_id;
  insert into public.tasks (
    workspace_id, test_version_id, ordinal, title, scenario, instruction,
    expected_path, success_rule, failure_rule, timeout_seconds, post_task_questions
  ) select workspace_id, v_new_version_id, ordinal, title, scenario, instruction,
      expected_path, success_rule, failure_rule, timeout_seconds, post_task_questions
    from public.tasks where test_version_id = v_source.id order by ordinal;
  insert into public.study_blocks (workspace_id, test_version_id, ordinal, kind, task_id, title, config)
    select b.workspace_id, v_new_version_id, b.ordinal, b.kind,
      case when b.task_id is null then null else nt.id end,
      b.title, b.config
    from public.study_blocks b
    left join public.tasks ot on ot.id = b.task_id
    left join public.tasks nt on nt.test_version_id = v_new_version_id and nt.ordinal = ot.ordinal
    where b.test_version_id = v_source.id order by b.ordinal;
  return v_new_version_id;
end;
$$;
revoke all on function public.create_draft_from_published(uuid) from public, anon;
grant execute on function public.create_draft_from_published(uuid) to authenticated, service_role;

-- Keep the existing anonymous-consent RPC but write the required session.test_id
-- explicitly. Both usability and method studies use this version-bound entry.
create or replace function public.create_anonymous_participant_session(
  p_test_version_id uuid, p_consent_version text, p_locale text default null
)
returns table (
  participant_id uuid, session_id uuid, workspace_id uuid,
  test_id uuid, test_version_id uuid, started_at timestamptz
)
language plpgsql security invoker set search_path = '' as $$
declare
  v_version public.test_versions%rowtype;
  v_participant_id uuid;
  v_session_id uuid;
  v_started_at timestamptz;
begin
  if nullif(trim(p_consent_version), '') is null then
    raise exception 'consent_version_required' using errcode = '22023';
  end if;
  select tv.* into v_version from public.test_versions tv
  join public.tests t on t.id = tv.test_id
  where tv.id = p_test_version_id and tv.lifecycle_status = 'published' and t.status = 'published';
  if v_version.id is null then
    raise exception 'published_test_version_not_found' using errcode = '22023';
  end if;
  if v_version.study_mode <> 'usability' then
    raise exception 'method_study_requires_screener_entry' using errcode = '22023';
  end if;
  insert into public.participants (workspace_id, test_id)
  values (v_version.workspace_id, v_version.test_id)
  returning id into v_participant_id;
  insert into public.sessions (
    workspace_id, test_id, test_version_id, participant_id,
    status, consent_version, consented_at, locale
  ) values (
    v_version.workspace_id, v_version.test_id, v_version.id, v_participant_id,
    'active', trim(p_consent_version), now(), nullif(trim(coalesce(p_locale, '')), '')
  ) returning id, public.sessions.started_at into v_session_id, v_started_at;
  return query select v_participant_id, v_session_id, v_version.workspace_id,
    v_version.test_id, v_version.id, v_started_at;
end;
$$;
revoke all on function public.create_anonymous_participant_session(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.create_anonymous_participant_session(uuid,text,text) to service_role;

create table public.study_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  test_version_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 160),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'used', 'rejected')),
  expires_at timestamptz not null,
  used_session_id uuid,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  foreign key (workspace_id, test_version_id)
    references public.test_versions (workspace_id, id) on delete cascade,
  foreign key (workspace_id, used_session_id)
    references public.sessions (workspace_id, id) on delete cascade,
  check ((status = 'used') = (used_session_id is not null))
);
create index study_invites_workspace_version_idx
  on public.study_invites (workspace_id, test_version_id, created_at desc);
alter table public.study_invites enable row level security;
alter table public.study_invites force row level security;
revoke all on public.study_invites from public, anon, authenticated;
grant select, insert, delete on public.study_invites to authenticated;
grant all on public.study_invites to service_role;
create policy study_invites_select_sensitive on public.study_invites
  for select to authenticated using (private.can_read_sensitive_workspace(workspace_id));
create policy study_invites_insert_editor on public.study_invites
  for insert to authenticated with check (
    private.is_research_editor(workspace_id)
    and status = 'pending' and used_session_id is null and used_at is null
    and expires_at > now()
    and exists (select 1 from public.test_versions tv
      where tv.id = test_version_id and tv.workspace_id = study_invites.workspace_id
        and tv.lifecycle_status = 'published' and tv.study_mode = 'methods')
  );
create policy study_invites_delete_editor on public.study_invites
  for delete to authenticated using (private.is_research_editor(workspace_id));

-- Server-only atomic invitation claim, screener gate, and consented session.
-- A rejected invited participant consumes the invite without creating a session.
create or replace function public.start_method_participant_session(
  p_test_version_id uuid, p_token_hash text, p_answers jsonb,
  p_consent_version text, p_locale text default null
)
returns table (
  eligible boolean, participant_id uuid, session_id uuid,
  workspace_id uuid, test_id uuid, test_version_id uuid, started_at timestamptz
)
language plpgsql security invoker set search_path = '' as $$
declare
  v_version public.test_versions%rowtype;
  v_invite public.study_invites%rowtype;
  v_question jsonb;
  v_answer text;
  v_eligible boolean := true;
  v_participant_id uuid;
  v_session_id uuid;
  v_started_at timestamptz;
begin
  if nullif(trim(p_consent_version), '') is null then
    raise exception 'consent_version_required' using errcode = '22023';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_screener_answers' using errcode = '22023';
  end if;
  select tv.* into v_version from public.test_versions tv
  join public.tests t on t.id = tv.test_id
  where tv.id = p_test_version_id and tv.lifecycle_status = 'published'
    and tv.study_mode = 'methods' and t.status = 'published';
  if v_version.id is null then
    raise exception 'published_study_not_found' using errcode = '22023';
  end if;
  if p_token_hash is null and v_version.invite_only then
    raise exception 'invite_required' using errcode = '22023';
  end if;
  if p_token_hash is not null then
    select si.* into v_invite from public.study_invites si
    where si.test_version_id = v_version.id and si.token_hash = p_token_hash
      and si.status = 'pending' and si.expires_at > now() for update;
    if v_invite.id is null then
      raise exception 'invite_unavailable' using errcode = '22023';
    end if;
  end if;
  for v_question in select value from jsonb_array_elements(v_version.screener_config -> 'questions') loop
    v_answer := p_answers ->> (v_question ->> 'id');
    if v_answer is null
      or not exists (select 1 from jsonb_array_elements(v_question -> 'options') o
        where o ->> 'id' = v_answer)
      or not exists (select 1 from jsonb_array_elements_text(v_question -> 'accept') a
        where a.value = v_answer) then
      v_eligible := false;
      exit;
    end if;
  end loop;
  if not v_eligible then
    if v_invite.id is not null then
      update public.study_invites set status = 'rejected', used_at = now() where id = v_invite.id;
    end if;
    return query select false, null::uuid, null::uuid, v_version.workspace_id,
      v_version.test_id, v_version.id, null::timestamptz;
    return;
  end if;
  insert into public.participants (workspace_id, test_id)
  values (v_version.workspace_id, v_version.test_id) returning id into v_participant_id;
  insert into public.sessions (
    workspace_id, test_id, test_version_id, participant_id,
    status, consent_version, consented_at, locale
  ) values (
    v_version.workspace_id, v_version.test_id, v_version.id, v_participant_id,
    'active', trim(p_consent_version), now(), nullif(trim(coalesce(p_locale, '')), '')
  ) returning id, public.sessions.started_at into v_session_id, v_started_at;
  if v_invite.id is not null then
    update public.study_invites set status = 'used', used_session_id = v_session_id,
      used_at = now() where id = v_invite.id;
  end if;
  return query select true, v_participant_id, v_session_id, v_version.workspace_id,
    v_version.test_id, v_version.id, v_started_at;
end;
$$;
revoke all on function public.start_method_participant_session(uuid,text,jsonb,text,text)
  from public, anon, authenticated;
grant execute on function public.start_method_participant_session(uuid,text,jsonb,text,text)
  to service_role;

-- Findings can cite an exact method response while retaining all legacy types.
alter table public.study_responses add constraint study_responses_workspace_id_uq unique (workspace_id, id);
alter table public.finding_evidence
  add column study_response_id uuid,
  add constraint finding_evidence_method_response_fk
    foreign key (workspace_id, study_response_id)
    references public.study_responses (workspace_id, id) on delete cascade;
alter table public.finding_evidence drop constraint finding_evidence_type_check;
alter table public.finding_evidence add constraint finding_evidence_type_check
  check (evidence_type in ('session', 'event', 'answer', 'path', 'heatmap', 'method_response'));
alter table public.finding_evidence drop constraint finding_evidence_typed_reference_check;
alter table public.finding_evidence add constraint finding_evidence_typed_reference_check check (
  (evidence_type = 'session' and session_id is not null)
  or (evidence_type = 'event' and session_id is not null and event_id is not null)
  or (evidence_type = 'answer' and session_id is not null and answer_id is not null)
  or (evidence_type = 'method_response' and session_id is not null and study_response_id is not null)
  or (evidence_type in ('path', 'heatmap') and session_id is not null and evidence_payload <> '{}'::jsonb)
);
create index finding_evidence_method_response_idx
  on public.finding_evidence (workspace_id, study_response_id) where study_response_id is not null;

create or replace function private.guard_method_finding_evidence()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_finding_version uuid;
  v_response_version uuid;
  v_response_session uuid;
begin
  if new.evidence_type <> 'method_response' then return new; end if;
  select test_version_id into v_finding_version from public.findings
  where id = new.finding_id and workspace_id = new.workspace_id;
  select test_version_id, session_id into v_response_version, v_response_session
  from public.study_responses where id = new.study_response_id and workspace_id = new.workspace_id;
  if v_finding_version is null or v_finding_version is distinct from v_response_version
    or new.session_id is distinct from v_response_session then
    raise exception 'method_evidence_context_mismatch' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_method_finding_evidence() from public, anon, authenticated, service_role;
create trigger finding_evidence_method_context_trg
before insert or update on public.finding_evidence
for each row execute function private.guard_method_finding_evidence();

-- The legacy session FK clears finding_evidence.session_id on deletion. A method
-- citation must instead disappear with its response, before that SET NULL fires.
create or replace function private.delete_method_evidence_with_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.finding_evidence
  where workspace_id = old.workspace_id and session_id = old.id
    and evidence_type = 'method_response';
  return old;
end;
$$;
revoke all on function private.delete_method_evidence_with_session()
  from public, anon, authenticated, service_role;
create trigger sessions_delete_method_evidence_trg
before delete on public.sessions
for each row execute function private.delete_method_evidence_with_session();
