-- MT-03: provider-neutral immutable Test Target snapshot.
-- Preserve legacy Figma columns/mapping for historical compatibility while making
-- target_provider + target_snapshot the canonical published-version boundary.

alter table public.test_versions
  add column if not exists target_provider text,
  add column if not exists target_snapshot jsonb;

update public.test_versions
set target_provider = case
      when provider = 'figma' then 'figma_prototype'
      else provider
    end,
    target_snapshot = jsonb_strip_nulls(jsonb_build_object(
      'provider', case when provider = 'figma' then 'figma_prototype' else provider end,
      'sourceUrl', prototype_mapping ->> 'sourceUrl',
      'environment', null,
      'launchMode', 'embed',
      'capabilities', coalesce(prototype_mapping -> 'capabilities', '{}'::jsonb),
      'providerConfig', jsonb_strip_nulls(jsonb_build_object(
        'fileKey', coalesce(prototype_mapping ->> 'fileKey', figma_file_key),
        'startNodeId', figma_start_node_id,
        'embedUrl', prototype_mapping ->> 'embedUrl'
      )),
      'snapshotVersion', 1
    ))
where target_snapshot is null
  and prototype_mapping ->> 'provider' = 'figma';

alter table public.test_versions
  drop constraint if exists test_versions_target_provider_ck,
  drop constraint if exists test_versions_target_snapshot_ck,
  drop constraint if exists test_versions_published_snapshot_ck;

alter table public.test_versions
  add constraint test_versions_target_provider_ck check (
    target_provider is null or target_provider in ('figma_prototype', 'first_party_web', 'external_web')
  ),
  add constraint test_versions_target_snapshot_ck check (
    target_snapshot is null or (
      jsonb_typeof(target_snapshot) = 'object'
      and target_snapshot ->> 'provider' in ('figma_prototype', 'first_party_web', 'external_web')
      and nullif(trim(target_snapshot ->> 'sourceUrl'), '') is not null
      and target_snapshot ->> 'launchMode' in ('embed', 'new_tab', 'same_tab', 'unsupported')
      and jsonb_typeof(target_snapshot -> 'capabilities') = 'object'
      and jsonb_typeof(target_snapshot -> 'providerConfig') = 'object'
      and (target_snapshot ->> 'snapshotVersion')::integer >= 1
    )
  ),
  add constraint test_versions_published_snapshot_ck check (
    lifecycle_status <> 'published' or (
      published_at is not null
      and target_provider is not null
      and target_snapshot is not null
      and target_snapshot ->> 'provider' = target_provider
    )
  );

create or replace function public.publish_draft_test_version(p_test_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version public.test_versions%rowtype;
  v_task_count integer;
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

  select count(*) into v_task_count from public.tasks where test_version_id = v_version.id;
  if v_task_count = 0 then
    raise exception 'at_least_one_task_required' using errcode = '22023';
  end if;

  update public.test_versions
  set lifecycle_status = 'published',
      published_at = now(),
      figma_version_id = null,
      success_rule_version = coalesce(success_rule_version, 'task-outcome-v1'),
      failure_rule_version = coalesce(failure_rule_version, 'task-outcome-v1'),
      abandonment_policy_version = coalesce(abandonment_policy_version, 'abandonment-v1')
  where id = v_version.id;

  update public.tests set status = 'published', updated_at = now() where id = p_test_id;
  return v_version.id;
end;
$$;

revoke all on function public.publish_draft_test_version(uuid) from public, anon;
grant execute on function public.publish_draft_test_version(uuid) to authenticated, service_role;

create or replace function public.create_draft_from_published(p_test_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_draft uuid;
  v_source public.test_versions%rowtype;
  v_new_version_id uuid;
  v_next_version integer;
begin
  perform 1 from public.tests where id = p_test_id for update;
  if not found then
    raise exception 'test_not_found_or_permission_denied' using errcode = '42501';
  end if;

  select id into v_existing_draft from public.test_versions
  where test_id = p_test_id and lifecycle_status = 'draft'
  order by version_no desc limit 1;
  if v_existing_draft is not null then return v_existing_draft; end if;

  select * into v_source from public.test_versions
  where test_id = p_test_id and lifecycle_status = 'published'
  order by version_no desc limit 1;
  if v_source.id is null then
    raise exception 'published_test_version_required' using errcode = '22023';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_next_version
  from public.test_versions where test_id = p_test_id;

  insert into public.test_versions (
    workspace_id, test_id, version_no, lifecycle_status, provider,
    figma_file_key, figma_version_id, figma_start_node_id, prototype_mapping,
    target_provider, target_snapshot, event_schema_version, success_rule_version,
    failure_rule_version, timeout_seconds, abandonment_policy_version, created_by
  ) values (
    v_source.workspace_id, v_source.test_id, v_next_version, 'draft', v_source.provider,
    v_source.figma_file_key, null, v_source.figma_start_node_id, v_source.prototype_mapping,
    v_source.target_provider, v_source.target_snapshot, v_source.event_schema_version,
    v_source.success_rule_version, v_source.failure_rule_version, v_source.timeout_seconds,
    v_source.abandonment_policy_version, auth.uid()
  ) returning id into v_new_version_id;

  insert into public.tasks (
    workspace_id, test_version_id, ordinal, title, scenario, instruction,
    expected_path, success_rule, failure_rule, timeout_seconds, post_task_questions
  )
  select workspace_id, v_new_version_id, ordinal, title, scenario, instruction,
    expected_path, success_rule, failure_rule, timeout_seconds, post_task_questions
  from public.tasks where test_version_id = v_source.id order by ordinal;

  return v_new_version_id;
end;
$$;

revoke all on function public.create_draft_from_published(uuid) from public, anon;
grant execute on function public.create_draft_from_published(uuid) to authenticated, service_role;

comment on column public.test_versions.target_provider is 'MT-03 canonical provider class for immutable Test Target snapshot.';
comment on column public.test_versions.target_snapshot is 'MT-03 immutable provider-neutral Test Target snapshot; never store provider secrets.';
comment on function public.publish_draft_test_version(uuid) is 'MT-03 atomic publish gate requiring a provider-neutral Test Target snapshot and at least one task.';