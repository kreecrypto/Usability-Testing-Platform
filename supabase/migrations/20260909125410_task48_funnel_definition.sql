-- Task 48: defined funnel configuration belongs to the internal published test version.
-- The representation is versioned so historical drop-off results remain reproducible.

alter table public.test_versions
  add column if not exists funnel_config jsonb;

alter table public.test_versions
  drop constraint if exists test_versions_funnel_config_ck;

alter table public.test_versions
  add constraint test_versions_funnel_config_ck check (
    funnel_config is null
    or (
      jsonb_typeof(funnel_config) = 'object'
      and funnel_config ->> 'version' = 'screen-funnel-v1'
      and jsonb_typeof(funnel_config -> 'screenIds') = 'array'
      and jsonb_array_length(funnel_config -> 'screenIds') >= 2
    )
  );

comment on column public.test_versions.funnel_config is
  'Task48 versioned screen funnel definition. V1 shape: {version:"screen-funnel-v1",screenIds:[canonical screen ids...]}. Published versions are immutable under Task32.';

create or replace function public.save_draft_funnel_config(
  p_test_id uuid,
  p_screen_ids text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_clean text[];
begin
  if p_screen_ids is null or coalesce(array_length(p_screen_ids, 1), 0) < 2 then
    raise exception 'funnel_requires_at_least_two_screens' using errcode = '22023';
  end if;

  select array_agg(trim(value) order by ordinal)
  into v_clean
  from unnest(p_screen_ids) with ordinality as item(value, ordinal);

  if exists (
    select 1
    from unnest(v_clean) as item(value)
    where value is null or value = ''
  ) then
    raise exception 'funnel_screen_id_required' using errcode = '22023';
  end if;

  if (select count(*) from unnest(v_clean) as item(value))
     <> (select count(distinct value) from unnest(v_clean) as item(value)) then
    raise exception 'funnel_screen_ids_must_be_unique' using errcode = '22023';
  end if;

  select tv.id
  into v_version_id
  from public.test_versions tv
  where tv.test_id = p_test_id
    and tv.lifecycle_status = 'draft'
  order by tv.version_no desc
  limit 1
  for update;

  if v_version_id is null then
    raise exception 'draft_test_version_required' using errcode = '22023';
  end if;

  update public.test_versions
  set funnel_config = jsonb_build_object(
        'version', 'screen-funnel-v1',
        'screenIds', to_jsonb(v_clean)
      )
  where id = v_version_id;

  return v_version_id;
end;
$$;

revoke all on function public.save_draft_funnel_config(uuid, text[]) from public, anon;
grant execute on function public.save_draft_funnel_config(uuid, text[]) to authenticated, service_role;

-- Task32 draft cloning must preserve the exact versioned funnel definition.
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
  perform 1
  from public.tests
  where id = p_test_id
  for update;

  if not found then
    raise exception 'test_not_found_or_permission_denied' using errcode = '42501';
  end if;

  select id into v_existing_draft
  from public.test_versions
  where test_id = p_test_id
    and lifecycle_status = 'draft'
  order by version_no desc
  limit 1;

  if v_existing_draft is not null then
    return v_existing_draft;
  end if;

  select * into v_source
  from public.test_versions
  where test_id = p_test_id
    and lifecycle_status = 'published'
  order by version_no desc
  limit 1;

  if v_source.id is null then
    raise exception 'published_test_version_required' using errcode = '22023';
  end if;

  select coalesce(max(version_no), 0) + 1
  into v_next_version
  from public.test_versions
  where test_id = p_test_id;

  insert into public.test_versions (
    workspace_id,
    test_id,
    version_no,
    lifecycle_status,
    provider,
    figma_file_key,
    figma_version_id,
    figma_start_node_id,
    prototype_mapping,
    event_schema_version,
    success_rule_version,
    failure_rule_version,
    timeout_seconds,
    abandonment_policy_version,
    funnel_config,
    created_by
  ) values (
    v_source.workspace_id,
    v_source.test_id,
    v_next_version,
    'draft',
    v_source.provider,
    v_source.figma_file_key,
    null,
    v_source.figma_start_node_id,
    v_source.prototype_mapping,
    v_source.event_schema_version,
    v_source.success_rule_version,
    v_source.failure_rule_version,
    v_source.timeout_seconds,
    v_source.abandonment_policy_version,
    v_source.funnel_config,
    auth.uid()
  ) returning id into v_new_version_id;

  insert into public.tasks (
    workspace_id,
    test_version_id,
    ordinal,
    title,
    scenario,
    instruction,
    expected_path,
    success_rule,
    failure_rule,
    timeout_seconds,
    post_task_questions
  )
  select
    workspace_id,
    v_new_version_id,
    ordinal,
    title,
    scenario,
    instruction,
    expected_path,
    success_rule,
    failure_rule,
    timeout_seconds,
    post_task_questions
  from public.tasks
  where test_version_id = v_source.id
  order by ordinal;

  return v_new_version_id;
end;
$$;

revoke all on function public.create_draft_from_published(uuid) from public, anon;
grant execute on function public.create_draft_from_published(uuid) to authenticated, service_role;
