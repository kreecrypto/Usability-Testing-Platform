-- Task 32: deterministic preview/publish/versioning for simplified V1.
-- The published snapshot is the internal test_version + its version-scoped task rows.
-- A Figma REST version id is intentionally NOT required; the exact validated public
-- prototype source URL/embed URL and start node are preserved in prototype_mapping.

do $$
declare
  v_constraint_name text;
begin
  select c.conname
  into v_constraint_name
  from pg_constraint c
  where c.conrelid = 'public.test_versions'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%figma_version_id%'
    and pg_get_constraintdef(c.oid) ilike '%published%'
  limit 1;

  if v_constraint_name is not null then
    execute format('alter table public.test_versions drop constraint %I', v_constraint_name);
  end if;
end
$$;

alter table public.test_versions
  drop constraint if exists test_versions_published_snapshot_ck;

alter table public.test_versions
  add constraint test_versions_published_snapshot_ck check (
    lifecycle_status <> 'published'
    or (
      published_at is not null
      and figma_file_key is not null
      and figma_start_node_id is not null
      and jsonb_typeof(prototype_mapping) = 'object'
      and prototype_mapping ->> 'provider' = 'figma'
      and nullif(trim(prototype_mapping ->> 'sourceUrl'), '') is not null
      and nullif(trim(prototype_mapping ->> 'embedUrl'), '') is not null
      and nullif(trim(prototype_mapping ->> 'fileKey'), '') is not null
    )
  );

create or replace function private.guard_published_test_version_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.lifecycle_status = 'published' then
    raise exception 'published_test_version_is_immutable' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.guard_published_test_version_immutable() from public, anon, authenticated, service_role;

drop trigger if exists test_versions_published_immutable_trg on public.test_versions;
create trigger test_versions_published_immutable_trg
before update or delete on public.test_versions
for each row execute function private.guard_published_test_version_immutable();

create or replace function private.guard_task_version_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select lifecycle_status into v_old_status
    from public.test_versions
    where id = old.test_version_id;
    if v_old_status = 'published' then
      raise exception 'published_test_version_tasks_are_immutable' using errcode = '55000';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select lifecycle_status into v_new_status
    from public.test_versions
    where id = new.test_version_id;
    if v_new_status = 'published' then
      raise exception 'published_test_version_tasks_are_immutable' using errcode = '55000';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.guard_task_version_immutable() from public, anon, authenticated, service_role;

drop trigger if exists tasks_published_version_immutable_trg on public.tasks;
create trigger tasks_published_version_immutable_trg
before insert or update or delete on public.tasks
for each row execute function private.guard_task_version_immutable();

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
  perform 1
  from public.tests
  where id = p_test_id
  for update;

  if not found then
    raise exception 'test_not_found_or_permission_denied' using errcode = '42501';
  end if;

  select * into v_version
  from public.test_versions
  where test_id = p_test_id
    and lifecycle_status = 'draft'
  order by version_no desc
  limit 1
  for update;

  if v_version.id is null then
    raise exception 'draft_test_version_required' using errcode = '22023';
  end if;

  if v_version.figma_file_key is null
     or v_version.figma_start_node_id is null
     or nullif(trim(v_version.prototype_mapping ->> 'sourceUrl'), '') is null
     or nullif(trim(v_version.prototype_mapping ->> 'embedUrl'), '') is null then
    raise exception 'publishable_prototype_snapshot_required' using errcode = '22023';
  end if;

  select count(*) into v_task_count
  from public.tasks
  where test_version_id = v_version.id;

  if v_task_count = 0 then
    raise exception 'at_least_one_task_required' using errcode = '22023';
  end if;

  update public.test_versions
  set lifecycle_status = 'published',
      published_at = now(),
      -- Simplified V1 deliberately does not require Figma REST file-version metadata.
      figma_version_id = null,
      success_rule_version = coalesce(success_rule_version, 'task-outcome-v1'),
      failure_rule_version = coalesce(failure_rule_version, 'task-outcome-v1'),
      abandonment_policy_version = coalesce(abandonment_policy_version, 'abandonment-v1')
  where id = v_version.id;

  update public.tests
  set status = 'published',
      updated_at = now()
  where id = p_test_id;

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

comment on function public.publish_draft_test_version(uuid) is
  'Task32 atomic publish gate. Publishes the latest visible draft only after prototype snapshot + task validation.';
comment on function public.create_draft_from_published(uuid) is
  'Task32 atomic immutable-version edit boundary. Reuses an existing draft or clones the latest published version and tasks.';
