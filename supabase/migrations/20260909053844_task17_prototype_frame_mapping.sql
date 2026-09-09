create or replace function public.save_figma_frame_mapping(
  p_workspace_id uuid,
  p_test_version_id uuid,
  p_task_id uuid,
  p_prototype_url text,
  p_file_key text,
  p_start_node_id text,
  p_success_node_ids text[],
  p_failure_node_ids text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_mapping jsonb;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if p_prototype_url is null or btrim(p_prototype_url) = '' then
    raise invalid_parameter_value using message = 'prototype_url_required';
  end if;
  if p_file_key is null or p_file_key !~ '^[A-Za-z0-9]+$' then
    raise invalid_parameter_value using message = 'invalid_figma_file_key';
  end if;
  if p_start_node_id is null or p_start_node_id !~ '^[0-9]+:[0-9]+$' then
    raise invalid_parameter_value using message = 'invalid_start_node_id';
  end if;
  if coalesce(cardinality(p_success_node_ids), 0) = 0 then
    raise invalid_parameter_value using message = 'success_node_ids_required';
  end if;
  if coalesce(cardinality(p_failure_node_ids), 0) = 0 then
    raise invalid_parameter_value using message = 'failure_node_ids_required';
  end if;
  if exists (
    select 1 from unnest(p_success_node_ids) as node_id
    where node_id !~ '^[0-9]+:[0-9]+$'
  ) then
    raise invalid_parameter_value using message = 'invalid_success_node_id';
  end if;
  if exists (
    select 1 from unnest(p_failure_node_ids) as node_id
    where node_id !~ '^[0-9]+:[0-9]+$'
  ) then
    raise invalid_parameter_value using message = 'invalid_failure_node_id';
  end if;
  if (
    select count(*) <> count(distinct node_id)
    from unnest(p_success_node_ids) as node_id
  ) then
    raise invalid_parameter_value using message = 'duplicate_success_node_id';
  end if;
  if (
    select count(*) <> count(distinct node_id)
    from unnest(p_failure_node_ids) as node_id
  ) then
    raise invalid_parameter_value using message = 'duplicate_failure_node_id';
  end if;

  v_mapping := jsonb_build_object(
    'version', 1,
    'source', 'explicit_node_ids',
    'prototypeUrl', p_prototype_url,
    'fileKey', p_file_key,
    'startNodeId', p_start_node_id,
    'successNodeIds', to_jsonb(p_success_node_ids),
    'failureNodeIds', to_jsonb(p_failure_node_ids)
  );

  update public.test_versions
  set figma_file_key = p_file_key,
      figma_start_node_id = p_start_node_id,
      prototype_mapping = v_mapping
  where id = p_test_version_id
    and workspace_id = p_workspace_id
    and lifecycle_status = 'draft';

  if not found then
    raise no_data_found using message = 'test_version_not_editable';
  end if;

  update public.tasks
  set success_rule = jsonb_build_object(
        'type', 'presented_node',
        'nodeIds', to_jsonb(p_success_node_ids)
      ),
      failure_rule = jsonb_build_object(
        'type', 'presented_node',
        'nodeIds', to_jsonb(p_failure_node_ids)
      ),
      updated_at = now()
  where id = p_task_id
    and workspace_id = p_workspace_id
    and test_version_id = p_test_version_id;

  if not found then
    raise no_data_found using message = 'task_not_found';
  end if;

  return v_mapping;
end;
$function$;

revoke all on function public.save_figma_frame_mapping(
  uuid, uuid, uuid, text, text, text, text[], text[]
) from public, anon, service_role;

grant execute on function public.save_figma_frame_mapping(
  uuid, uuid, uuid, text, text, text, text[], text[]
) to authenticated;
