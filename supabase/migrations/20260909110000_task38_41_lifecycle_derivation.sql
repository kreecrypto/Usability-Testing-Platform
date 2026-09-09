-- Tasks 38/40/41: server-side deterministic derived-event + lifecycle projection.
-- Participant ingestion remains RAW ONLY. This trigger runs in the same database
-- transaction as a newly accepted raw row, so retry/dedupe cannot create a
-- second canonical task/session outcome.
--
-- Task41 friction rule values are explicitly PROPOSED because current planning
-- sources define reproducibility/versioning but do not specify thresholds:
--   figma-handled-misclick-v1: Figma pointer payload handled=false
--   immediate-aba-backtrack-v1: screen path A -> B -> A
--   rage-click-v1: >=3 canonical clicks within 1000ms and normalized radius 0.04

create or replace function private.apply_event_lifecycle_and_derivations()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_existing_terminal boolean;
  v_actual_path text[];
  v_expected_path text[];
  v_outcome text;
  v_prev_screen text;
  v_prev2_screen text;
  v_x double precision;
  v_y double precision;
  v_rage_neighbors integer;
  v_has_recent_rage boolean;
begin
  -- Projection from accepted event evidence to the normalized session/task rows.
  if new.event_layer = 'raw' and new.event_name = 'task_started' and new.task_id is not null then
    insert into public.task_sessions (session_id, task_id, started_at)
    values (new.session_id, new.task_id, new.occurred_at)
    on conflict (session_id, task_id) do nothing;
  elsif new.event_layer = 'raw' and new.event_name in ('task_give_up','task_timeout','task_abandoned','task_technical_blocked') and new.task_id is not null then
    update public.task_sessions
    set outcome = case new.event_name
        when 'task_give_up' then 'give_up'
        when 'task_timeout' then 'timeout'
        when 'task_abandoned' then 'abandoned'
        else 'technical_blocked'
      end,
      ended_at = new.occurred_at,
      updated_at = now()
    where session_id = new.session_id
      and task_id = new.task_id
      and outcome is null;
  elsif new.event_layer = 'derived' and new.event_name in ('task_success','task_failed') and new.task_id is not null then
    v_outcome := case
      when new.event_name = 'task_failed' then 'failed'
      when new.payload ->> 'outcome' in ('success_direct','success_indirect') then new.payload ->> 'outcome'
      else null
    end;
    if v_outcome is not null then
      update public.task_sessions
      set outcome = v_outcome,
          ended_at = new.occurred_at,
          updated_at = now()
      where session_id = new.session_id
        and task_id = new.task_id
        and outcome is null;
    end if;
  end if;

  if new.event_layer = 'raw' and new.event_name in ('session_completed','session_abandoned','session_technical_blocked') then
    update public.sessions
    set status = case new.event_name
        when 'session_completed' then 'completed'
        when 'session_abandoned' then 'abandoned'
        else 'technical_blocked'
      end,
      completed_at = new.occurred_at
    where id = new.session_id
      and status = 'active';
  end if;

  -- Derived logic is only evaluated from accepted raw evidence.
  if new.event_layer <> 'raw' or new.task_id is null then
    return new;
  end if;

  select exists (
    select 1
    from public.task_sessions ts
    where ts.session_id = new.session_id
      and ts.task_id = new.task_id
      and ts.outcome is not null
  ) into v_existing_terminal;

  if new.event_name = 'screen_view' and new.screen_id is not null then
    select * into v_task from public.tasks where id = new.task_id;

    -- Terminal success/failure: first valid terminal wins.
    if not v_existing_terminal and v_task.id is not null then
      if jsonb_typeof(v_task.failure_rule -> 'nodeIds') = 'array'
         and exists (
           select 1 from jsonb_array_elements_text(v_task.failure_rule -> 'nodeIds') n(node_id)
           where n.node_id = new.screen_id
         ) then
        insert into public.events (
          event_id, workspace_id, session_id, participant_id, test_id, test_version_id,
          task_id, screen_id, idempotency_key, event_name, event_layer, source,
          schema_version, occurred_at, received_at, sequence, payload,
          derived_from_event_ids, rule_version
        ) values (
          gen_random_uuid(), new.workspace_id, new.session_id, new.participant_id, new.test_id, new.test_version_id,
          new.task_id, new.screen_id, 'derived:task-outcome-v1:' || new.event_id::text || ':failed',
          'task_failed', 'derived', 'rules_engine', new.schema_version, new.occurred_at, now(), null,
          '{}'::jsonb, array[new.event_id], 'task-outcome-v1'
        ) on conflict (session_id, idempotency_key) do nothing;
      elsif jsonb_typeof(v_task.success_rule -> 'nodeIds') = 'array'
         and exists (
           select 1 from jsonb_array_elements_text(v_task.success_rule -> 'nodeIds') n(node_id)
           where n.node_id = new.screen_id
         ) then
        select coalesce(array_agg(e.screen_id order by e.sequence, e.occurred_at, e.event_id), '{}'::text[])
        into v_actual_path
        from public.events e
        where e.session_id = new.session_id
          and e.task_id = new.task_id
          and e.event_layer = 'raw'
          and e.event_name = 'screen_view'
          and e.sequence <= new.sequence
          and e.screen_id is not null;

        select coalesce(array_agg(p.node_id order by p.ordinality), '{}'::text[])
        into v_expected_path
        from jsonb_array_elements_text(v_task.expected_path) with ordinality as p(node_id, ordinality);

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
          new.task_id, new.screen_id, 'derived:task-outcome-v1:' || new.event_id::text || ':success',
          'task_success', 'derived', 'rules_engine', new.schema_version, new.occurred_at, now(), null,
          jsonb_build_object('outcome', v_outcome), array[new.event_id], 'task-outcome-v1'
        ) on conflict (session_id, idempotency_key) do nothing;
      end if;
    end if;

    -- PROPOSED immediate A->B->A backtrack rule. No raw back/forward event is invented.
    select e.screen_id into v_prev_screen
    from public.events e
    where e.session_id = new.session_id and e.task_id = new.task_id
      and e.event_layer = 'raw' and e.event_name = 'screen_view'
      and e.sequence < new.sequence and e.screen_id is not null
    order by e.sequence desc, e.occurred_at desc, e.event_id desc
    limit 1;

    select e.screen_id into v_prev2_screen
    from public.events e
    where e.session_id = new.session_id and e.task_id = new.task_id
      and e.event_layer = 'raw' and e.event_name = 'screen_view'
      and e.sequence < new.sequence and e.screen_id is not null
    order by e.sequence desc, e.occurred_at desc, e.event_id desc
    offset 1 limit 1;

    if v_prev2_screen is not null and new.screen_id = v_prev2_screen and new.screen_id is distinct from v_prev_screen then
      insert into public.events (
        event_id, workspace_id, session_id, participant_id, test_id, test_version_id,
        task_id, screen_id, idempotency_key, event_name, event_layer, source,
        schema_version, occurred_at, received_at, sequence, payload,
        derived_from_event_ids, rule_version
      ) values (
        gen_random_uuid(), new.workspace_id, new.session_id, new.participant_id, new.test_id, new.test_version_id,
        new.task_id, new.screen_id, 'derived:backtrack-v1:' || new.event_id::text,
        'backtrack', 'derived', 'analytics', new.schema_version, new.occurred_at, now(), null,
        jsonb_build_object('pattern','A-B-A'), array[new.event_id], 'immediate-aba-backtrack-v1'
      ) on conflict (session_id, idempotency_key) do nothing;
    end if;
  end if;

  if new.event_name = 'pointer_interaction' then
    -- Figma documents `handled`; false is used by the PROPOSED versioned misclick rule.
    if new.payload ->> 'provider' = 'figma'
       and jsonb_typeof(new.payload -> 'handled') = 'boolean'
       and (new.payload ->> 'handled')::boolean = false then
      insert into public.events (
        event_id, workspace_id, session_id, participant_id, test_id, test_version_id,
        task_id, screen_id, idempotency_key, event_name, event_layer, source,
        schema_version, occurred_at, received_at, sequence, payload,
        derived_from_event_ids, rule_version
      ) values (
        gen_random_uuid(), new.workspace_id, new.session_id, new.participant_id, new.test_id, new.test_version_id,
        new.task_id, new.screen_id, 'derived:misclick-v1:' || new.event_id::text,
        'misclick', 'derived', 'analytics', new.schema_version, new.occurred_at, now(), null,
        jsonb_build_object('provider','figma','handled',false), array[new.event_id], 'figma-handled-misclick-v1'
      ) on conflict (session_id, idempotency_key) do nothing;
    end if;

    -- Rage-click is only eligible when Task39 canonical normalized coordinates exist.
    if jsonb_typeof(new.payload #> '{canonicalPoint,normalizedX}') = 'number'
       and jsonb_typeof(new.payload #> '{canonicalPoint,normalizedY}') = 'number' then
      v_x := (new.payload #>> '{canonicalPoint,normalizedX}')::double precision;
      v_y := (new.payload #>> '{canonicalPoint,normalizedY}')::double precision;

      select count(*) into v_rage_neighbors
      from public.events e
      where e.session_id = new.session_id
        and e.task_id = new.task_id
        and e.event_layer = 'raw'
        and e.event_name = 'pointer_interaction'
        and e.sequence < new.sequence
        and e.occurred_at >= new.occurred_at - interval '1000 milliseconds'
        and jsonb_typeof(e.payload #> '{canonicalPoint,normalizedX}') = 'number'
        and jsonb_typeof(e.payload #> '{canonicalPoint,normalizedY}') = 'number'
        and sqrt(
          power((e.payload #>> '{canonicalPoint,normalizedX}')::double precision - v_x, 2)
          + power((e.payload #>> '{canonicalPoint,normalizedY}')::double precision - v_y, 2)
        ) <= 0.04;

      select exists (
        select 1 from public.events d
        where d.session_id = new.session_id
          and d.task_id = new.task_id
          and d.event_layer = 'derived'
          and d.event_name = 'rage_click'
          and d.occurred_at >= new.occurred_at - interval '1000 milliseconds'
      ) into v_has_recent_rage;

      if v_rage_neighbors >= 2 and not v_has_recent_rage then
        insert into public.events (
          event_id, workspace_id, session_id, participant_id, test_id, test_version_id,
          task_id, screen_id, idempotency_key, event_name, event_layer, source,
          schema_version, occurred_at, received_at, sequence, payload,
          derived_from_event_ids, rule_version
        ) values (
          gen_random_uuid(), new.workspace_id, new.session_id, new.participant_id, new.test_id, new.test_version_id,
          new.task_id, new.screen_id, 'derived:rage-click-v1:' || new.event_id::text,
          'rage_click', 'derived', 'analytics', new.schema_version, new.occurred_at, now(), null,
          jsonb_build_object('minClicks',3,'windowMs',1000,'radiusNormalized',0.04), array[new.event_id], 'rage-click-v1'
        ) on conflict (session_id, idempotency_key) do nothing;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.apply_event_lifecycle_and_derivations() from public, anon, authenticated;

drop trigger if exists events_lifecycle_and_derivations_trg on public.events;
create trigger events_lifecycle_and_derivations_trg
after insert on public.events
for each row execute function private.apply_event_lifecycle_and_derivations();
