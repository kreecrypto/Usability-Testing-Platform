-- MT-08: provider-neutral deterministic task success/failure rules.
-- Canonical V2 rules evaluate only accepted raw evidence supported by the immutable
-- Test Target capability snapshot. Legacy Figma presented_node rules remain valid.

create or replace function private.task_rule_values(p_rule jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_values jsonb;
  v_result text[];
begin
  if jsonb_typeof(p_rule) <> 'object' then
    return null;
  end if;

  if p_rule ->> 'type' = 'presented_node' then
    v_values := p_rule -> 'nodeIds';
  elsif p_rule ->> 'version' = '2'
    and p_rule ->> 'type' in ('screen','url','route','element','completion_signal') then
    v_values := p_rule -> 'values';
  else
    return null;
  end if;

  if jsonb_typeof(v_values) <> 'array' or jsonb_array_length(v_values) = 0 then
    return null;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_values) as e(value)
    where jsonb_typeof(e.value) <> 'string'
       or btrim(e.value #>> '{}') = ''
       or length(btrim(e.value #>> '{}')) > 2048
  ) then
    return null;
  end if;

  select array_agg(btrim(e.value #>> '{}') order by e.ordinality)
  into v_result
  from jsonb_array_elements(v_values) with ordinality as e(value, ordinality);

  if cardinality(v_result) <> (
    select count(distinct v.value)
    from unnest(v_result) as v(value)
  ) then
    return null;
  end if;

  return v_result;
end;
$$;

revoke all on function private.task_rule_values(jsonb) from public, anon, authenticated, service_role;

create or replace function private.task_rule_event_channel(p_rule jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_rule ->> 'type'
    when 'presented_node' then 'screen_view'
    when 'screen' then 'screen_view'
    when 'url' then 'screen_view'
    when 'route' then 'screen_view'
    when 'element' then 'pointer_interaction'
    when 'completion_signal' then 'completion_signal'
    else null
  end;
$$;

revoke all on function private.task_rule_event_channel(jsonb) from public, anon, authenticated, service_role;

create or replace function private.task_rule_publishable(p_rule jsonb, p_target jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_type text := p_rule ->> 'type';
  v_provider text := p_target ->> 'provider';
  v_values text[] := private.task_rule_values(p_rule);
  v_instrumentation text := p_target #>> '{capabilities,instrumentation}';
  v_screen text := p_target #>> '{capabilities,screen}';
  v_pointer text := p_target #>> '{capabilities,pointer}';
begin
  if jsonb_typeof(p_target) <> 'object'
     or jsonb_typeof(p_target -> 'capabilities') <> 'object'
     or v_values is null then
    return false;
  end if;

  if v_type = 'presented_node' then
    return v_provider = 'figma_prototype'
      and v_screen = 'Available'
      and not exists (
        select 1 from unnest(v_values) as v(value)
        where v.value !~ '^[0-9]+:[0-9]+$'
      );
  end if;

  if p_rule ->> 'version' <> '2' then
    return false;
  end if;

  if v_type = 'screen' then
    return v_screen = 'Available';
  elsif v_type = 'url' then
    return v_provider <> 'figma_prototype'
      and v_instrumentation = 'Available'
      and not exists (
        select 1 from unnest(v_values) as v(value)
        where v.value !~ '^https?://'
      );
  elsif v_type = 'route' then
    return v_provider <> 'figma_prototype'
      and v_instrumentation = 'Available'
      and not exists (
        select 1 from unnest(v_values) as v(value)
        where v.value !~ '^/' or v.value ~ '[[:space:]]'
      );
  elsif v_type = 'element' then
    return v_provider <> 'figma_prototype'
      and v_instrumentation = 'Available'
      and v_pointer = 'Available';
  elsif v_type = 'completion_signal' then
    return v_provider <> 'figma_prototype'
      and v_instrumentation = 'Available';
  end if;

  return false;
end;
$$;

revoke all on function private.task_rule_publishable(jsonb,jsonb) from public, anon, authenticated, service_role;

create or replace function private.task_rules_conflict(p_success jsonb, p_failure jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_success_type text := p_success ->> 'type';
  v_failure_type text := p_failure ->> 'type';
  v_success_values text[] := private.task_rule_values(p_success);
  v_failure_values text[] := private.task_rule_values(p_failure);
  v_success_channel text := private.task_rule_event_channel(p_success);
  v_failure_channel text := private.task_rule_event_channel(p_failure);
  v_screen_pair boolean := v_success_type in ('screen','presented_node')
    and v_failure_type in ('screen','presented_node');
begin
  if v_success_values is null or v_failure_values is null then
    return true;
  end if;
  if v_success_channel is null or v_failure_channel is null then
    return true;
  end if;
  if v_success_channel <> v_failure_channel then
    return false;
  end if;

  -- V1 fails closed when two different predicates inspect the same raw event,
  -- because a single event could satisfy both without an explicit precedence contract.
  if v_success_type <> v_failure_type and not v_screen_pair then
    return true;
  end if;

  return exists (
    select 1
    from unnest(v_success_values) as s(value)
    join unnest(v_failure_values) as f(value) using (value)
  );
end;
$$;

revoke all on function private.task_rules_conflict(jsonb,jsonb) from public, anon, authenticated, service_role;

create or replace function private.task_rule_matches(
  p_rule jsonb,
  p_event_name text,
  p_screen_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_type text := p_rule ->> 'type';
  v_values text[] := private.task_rule_values(p_rule);
  v_candidate text;
begin
  if v_values is null then
    return false;
  end if;

  if v_type in ('presented_node','screen') then
    return p_event_name = 'screen_view'
      and p_screen_id is not null
      and p_screen_id = any(v_values);
  elsif v_type = 'url' then
    v_candidate := p_payload ->> 'url';
    return p_event_name = 'screen_view'
      and v_candidate is not null
      and v_candidate = any(v_values);
  elsif v_type = 'route' then
    v_candidate := p_payload ->> 'route';
    return p_event_name = 'screen_view'
      and v_candidate is not null
      and v_candidate = any(v_values);
  elsif v_type = 'element' then
    v_candidate := coalesce(p_payload ->> 'elementId', p_payload ->> 'targetElementId');
    return p_event_name = 'pointer_interaction'
      and v_candidate is not null
      and v_candidate = any(v_values);
  elsif v_type = 'completion_signal' then
    v_candidate := p_payload ->> 'signalId';
    return p_event_name = 'completion_signal'
      and v_candidate is not null
      and v_candidate = any(v_values);
  end if;

  return false;
end;
$$;

revoke all on function private.task_rule_matches(jsonb,text,text,jsonb) from public, anon, authenticated, service_role;

create or replace function public.save_task_outcome_rules(
  p_workspace_id uuid,
  p_test_version_id uuid,
  p_task_id uuid,
  p_success_rule jsonb,
  p_failure_rule jsonb,
  p_expected_path text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version public.test_versions%rowtype;
  v_expected_path text[] := coalesce(p_expected_path, '{}'::text[]);
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select * into v_version
  from public.test_versions
  where id = p_test_version_id
    and workspace_id = p_workspace_id
    and lifecycle_status = 'draft'
  for update;

  if v_version.id is null then
    raise no_data_found using message = 'draft_test_version_required';
  end if;

  if v_version.target_snapshot is null then
    raise invalid_parameter_value using message = 'target_snapshot_required';
  end if;

  if not private.task_rule_publishable(p_success_rule, v_version.target_snapshot)
     or not private.task_rule_publishable(p_failure_rule, v_version.target_snapshot) then
    raise invalid_parameter_value using message = 'unsupported_rule_for_target';
  end if;

  if private.task_rules_conflict(p_success_rule, p_failure_rule) then
    raise invalid_parameter_value using message = 'conflicting_terminal_rules';
  end if;

  if exists (
    select 1 from unnest(v_expected_path) as p(value)
    where btrim(p.value) = '' or length(btrim(p.value)) > 512
  ) then
    raise invalid_parameter_value using message = 'invalid_expected_path';
  end if;

  if cardinality(v_expected_path) <> (
    select count(distinct btrim(p.value))
    from unnest(v_expected_path) as p(value)
  ) then
    raise invalid_parameter_value using message = 'duplicate_expected_path_screen';
  end if;

  update public.tasks
  set success_rule = p_success_rule,
      failure_rule = p_failure_rule,
      expected_path = to_jsonb(v_expected_path),
      updated_at = now()
  where id = p_task_id
    and workspace_id = p_workspace_id
    and test_version_id = p_test_version_id;

  if not found then
    raise no_data_found using message = 'task_not_found';
  end if;

  return jsonb_build_object(
    'successRule', p_success_rule,
    'failureRule', p_failure_rule,
    'expectedPath', to_jsonb(v_expected_path)
  );
end;
$$;

revoke all on function public.save_task_outcome_rules(uuid,uuid,uuid,jsonb,jsonb,text[]) from public, anon, service_role;
grant execute on function public.save_task_outcome_rules(uuid,uuid,uuid,jsonb,jsonb,text[]) to authenticated;

create or replace function public.publish_draft_test_version(p_test_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version public.test_versions%rowtype;
  v_task_count integer;
  v_invalid_rule_count integer;
  v_has_v2_rules boolean;
begin
  perform 1 from public.tests where id = p_test_id for update;
  if not found then
    raise exception 'test_not_found_or_permission_denied' using errcode = '42501';
  end if;

  select * into v_version
  from public.test_versions
  where test_id = p_test_id and lifecycle_status = 'draft'
  order by version_no desc limit 1 for update;

  if v_version.id is null then
    raise exception 'draft_test_version_required' using errcode = '22023';
  end if;

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

  select count(*) into v_task_count
  from public.tasks
  where test_version_id = v_version.id;

  if v_task_count = 0 then
    raise exception 'at_least_one_task_required' using errcode = '22023';
  end if;

  select count(*) into v_invalid_rule_count
  from public.tasks t
  where t.test_version_id = v_version.id
    and (
      not private.task_rule_publishable(t.success_rule, v_version.target_snapshot)
      or not private.task_rule_publishable(t.failure_rule, v_version.target_snapshot)
      or private.task_rules_conflict(t.success_rule, t.failure_rule)
    );

  if v_invalid_rule_count > 0 then
    raise exception 'publishable_task_rules_required' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.tasks t
    where t.test_version_id = v_version.id
      and (t.success_rule ->> 'version' = '2' or t.failure_rule ->> 'version' = '2')
  ) into v_has_v2_rules;

  update public.test_versions
  set lifecycle_status = 'published',
      published_at = now(),
      figma_version_id = null,
      success_rule_version = case
        when v_has_v2_rules then 'task-outcome-v2'
        else coalesce(success_rule_version, 'task-outcome-v1')
      end,
      failure_rule_version = case
        when v_has_v2_rules then 'task-outcome-v2'
        else coalesce(failure_rule_version, 'task-outcome-v1')
      end,
      abandonment_policy_version = coalesce(abandonment_policy_version, 'abandonment-v1')
  where id = v_version.id;

  update public.tests
  set status = 'published', updated_at = now()
  where id = p_test_id;

  return v_version.id;
end;
$$;

revoke all on function public.publish_draft_test_version(uuid) from public, anon;
grant execute on function public.publish_draft_test_version(uuid) to authenticated, service_role;

create or replace function private.apply_provider_neutral_task_outcome_v2()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_existing_terminal boolean;
  v_failure_match boolean;
  v_success_match boolean;
  v_actual_path text[];
  v_expected_path text[];
  v_outcome text;
begin
  if new.event_layer <> 'raw'
     or new.task_id is null
     or new.event_name not in ('screen_view','pointer_interaction','completion_signal') then
    return new;
  end if;

  select exists (
    select 1
    from public.task_sessions ts
    where ts.session_id = new.session_id
      and ts.task_id = new.task_id
      and ts.outcome is not null
  ) into v_existing_terminal;

  if v_existing_terminal then
    return new;
  end if;

  select * into v_task
  from public.tasks
  where id = new.task_id;

  if v_task.id is null then
    return new;
  end if;

  if coalesce(v_task.success_rule ->> 'version', '') <> '2'
     and coalesce(v_task.failure_rule ->> 'version', '') <> '2' then
    return new;
  end if;

  v_failure_match := private.task_rule_matches(v_task.failure_rule, new.event_name, new.screen_id, new.payload);
  v_success_match := private.task_rule_matches(v_task.success_rule, new.event_name, new.screen_id, new.payload);

  if not v_failure_match and not v_success_match then
    return new;
  end if;

  -- Invalid/unpublished mixed predicates still fail safe: failure wins.
  if v_failure_match then
    insert into public.events (
      event_id, workspace_id, session_id, participant_id, test_id, test_version_id,
      task_id, screen_id, idempotency_key, event_name, event_layer, source,
      schema_version, occurred_at, received_at, sequence, payload,
      derived_from_event_ids, rule_version
    ) values (
      gen_random_uuid(), new.workspace_id, new.session_id, new.participant_id, new.test_id, new.test_version_id,
      new.task_id, new.screen_id, 'derived:task-outcome-v2:' || new.event_id::text || ':failed',
      'task_failed', 'derived', 'rules_engine', new.schema_version, new.occurred_at, now(), null,
      jsonb_build_object('ruleType', v_task.failure_rule ->> 'type'),
      array[new.event_id], 'task-outcome-v2'
    ) on conflict (session_id, idempotency_key) do nothing;
    return new;
  end if;

  select coalesce(array_agg(e.screen_id order by e.sequence, e.occurred_at, e.event_id), '{}'::text[])
  into v_actual_path
  from public.events e
  where e.session_id = new.session_id
    and e.task_id = new.task_id
    and e.event_layer = 'raw'
    and e.event_name = 'screen_view'
    and (new.sequence is null or e.sequence <= new.sequence)
    and e.screen_id is not null;

  select coalesce(array_agg(p.value order by p.ordinality), '{}'::text[])
  into v_expected_path
  from jsonb_array_elements_text(v_task.expected_path) with ordinality as p(value, ordinality);

  v_outcome := case
    when cardinality(v_expected_path) = 0 or v_actual_path = v_expected_path then 'success_direct'
    else 'success_indirect'
  end;

  insert into public.events (
    event_id, workspace_id, session_id, participant_id, test_id, test_version_id,
    task_id, screen_id, idempotency_key, event_name, event_layer, source,
    schema_version, occurred_at, received_at, sequence, payload,
    derived_from_event_ids, rule_version
  ) values (
    gen_random_uuid(), new.workspace_id, new.session_id, new.participant_id, new.test_id, new.test_version_id,
    new.task_id, new.screen_id, 'derived:task-outcome-v2:' || new.event_id::text || ':success',
    'task_success', 'derived', 'rules_engine', new.schema_version, new.occurred_at, now(), null,
    jsonb_build_object('outcome', v_outcome, 'ruleType', v_task.success_rule ->> 'type'),
    array[new.event_id], 'task-outcome-v2'
  ) on conflict (session_id, idempotency_key) do nothing;

  return new;
end;
$$;

revoke all on function private.apply_provider_neutral_task_outcome_v2() from public, anon, authenticated, service_role;

drop trigger if exists events_provider_neutral_task_outcome_v2_trg on public.events;
create trigger events_provider_neutral_task_outcome_v2_trg
after insert on public.events
for each row execute function private.apply_provider_neutral_task_outcome_v2();

comment on function public.save_task_outcome_rules(uuid,uuid,uuid,jsonb,jsonb,text[]) is
  'MT-08 authenticated draft-only rule editor. DB validates target capability and terminal conflicts.';
comment on function public.publish_draft_test_version(uuid) is
  'MT-08 atomic publish gate: immutable target + successful preflight + deterministic capability-supported terminal rules.';
