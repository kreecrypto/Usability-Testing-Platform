-- Task 39: bind source-backed Figma node geometry to one UTP test_version.
-- Simplified V1 does not require Figma REST version metadata. The immutable
-- published test_version id is the geometry version identity.

create or replace function public.save_figma_geometry_snapshot(
  p_workspace_id uuid,
  p_test_version_id uuid,
  p_file_key text,
  p_geometry jsonb
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
  if p_file_key is null or p_file_key !~ '^[A-Za-z0-9]+$' then
    raise invalid_parameter_value using message = 'invalid_figma_file_key';
  end if;
  if jsonb_typeof(p_geometry) <> 'object' then
    raise invalid_parameter_value using message = 'geometry_snapshot_object_required';
  end if;
  if p_geometry ->> 'version' <> '1'
     or p_geometry ->> 'transformVersion' <> 'figma-heatmap-v1'
     or p_geometry ->> 'source' <> 'figma_node_bounds' then
    raise invalid_parameter_value using message = 'invalid_geometry_contract';
  end if;
  if p_geometry ->> 'geometryVersionId' <> p_test_version_id::text then
    raise invalid_parameter_value using message = 'geometry_version_must_match_test_version';
  end if;
  if p_geometry ->> 'fileKey' <> p_file_key then
    raise invalid_parameter_value using message = 'geometry_file_key_mismatch';
  end if;
  if jsonb_typeof(p_geometry -> 'nodes') <> 'object'
     or coalesce(jsonb_object_length(p_geometry -> 'nodes'), 0) = 0 then
    raise invalid_parameter_value using message = 'geometry_nodes_required';
  end if;
  if jsonb_typeof(p_geometry -> 'presentedNodeIds') <> 'array'
     or jsonb_array_length(p_geometry -> 'presentedNodeIds') = 0 then
    raise invalid_parameter_value using message = 'presented_node_ids_required';
  end if;
  if exists (
    select 1
    from jsonb_each(p_geometry -> 'nodes') as node(node_id, bounds)
    where node.node_id !~ '^[0-9]+:[0-9]+$'
       or jsonb_typeof(node.bounds) <> 'object'
       or jsonb_typeof(node.bounds -> 'x') <> 'number'
       or jsonb_typeof(node.bounds -> 'y') <> 'number'
       or jsonb_typeof(node.bounds -> 'width') <> 'number'
       or jsonb_typeof(node.bounds -> 'height') <> 'number'
       or (node.bounds ->> 'width')::numeric <= 0
       or (node.bounds ->> 'height')::numeric <= 0
  ) then
    raise invalid_parameter_value using message = 'invalid_node_geometry';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_geometry -> 'presentedNodeIds') as presented(node_id)
    where presented.node_id !~ '^[0-9]+:[0-9]+$'
       or not ((p_geometry -> 'nodes') ? presented.node_id)
  ) then
    raise invalid_parameter_value using message = 'presented_node_geometry_missing';
  end if;

  update public.test_versions
  set prototype_mapping = jsonb_set(
        coalesce(prototype_mapping, '{}'::jsonb),
        '{geometry}',
        p_geometry,
        true
      )
  where id = p_test_version_id
    and workspace_id = p_workspace_id
    and lifecycle_status = 'draft'
    and figma_file_key = p_file_key
  returning prototype_mapping into v_mapping;

  if not found then
    raise no_data_found using message = 'test_version_not_editable_or_file_mismatch';
  end if;

  return v_mapping;
end;
$function$;

revoke all on function public.save_figma_geometry_snapshot(uuid, uuid, text, jsonb)
  from public, anon, service_role;
grant execute on function public.save_figma_geometry_snapshot(uuid, uuid, text, jsonb)
  to authenticated;

-- Task 17 originally replaced prototype_mapping wholesale. Preserve source/embed
-- metadata and Task39 geometry when frame targets are edited on the same draft.
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
  v_existing_mapping jsonb;
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
  if exists (select 1 from unnest(p_success_node_ids) as node_id where node_id !~ '^[0-9]+:[0-9]+$') then
    raise invalid_parameter_value using message = 'invalid_success_node_id';
  end if;
  if exists (select 1 from unnest(p_failure_node_ids) as node_id where node_id !~ '^[0-9]+:[0-9]+$') then
    raise invalid_parameter_value using message = 'invalid_failure_node_id';
  end if;
  if (select count(*) <> count(distinct node_id) from unnest(p_success_node_ids) as node_id) then
    raise invalid_parameter_value using message = 'duplicate_success_node_id';
  end if;
  if (select count(*) <> count(distinct node_id) from unnest(p_failure_node_ids) as node_id) then
    raise invalid_parameter_value using message = 'duplicate_failure_node_id';
  end if;

  select prototype_mapping into v_existing_mapping
  from public.test_versions
  where id = p_test_version_id
    and workspace_id = p_workspace_id
    and lifecycle_status = 'draft'
  for update;

  if not found then
    raise no_data_found using message = 'test_version_not_editable';
  end if;

  v_mapping := coalesce(v_existing_mapping, '{}'::jsonb) || jsonb_build_object(
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

  update public.tasks
  set success_rule = jsonb_build_object('type', 'presented_node', 'nodeIds', to_jsonb(p_success_node_ids)),
      failure_rule = jsonb_build_object('type', 'presented_node', 'nodeIds', to_jsonb(p_failure_node_ids)),
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
