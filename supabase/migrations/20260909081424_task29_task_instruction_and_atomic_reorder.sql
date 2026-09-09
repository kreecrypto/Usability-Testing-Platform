alter table public.tasks add column if not exists instruction text;

alter table public.tasks drop constraint if exists tasks_test_version_id_ordinal_key;
alter table public.tasks
  add constraint tasks_test_version_id_ordinal_key
  unique (test_version_id, ordinal)
  deferrable initially immediate;

create or replace function public.reorder_draft_tasks(
  p_test_version_id uuid,
  p_task_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_visible_count integer;
  v_requested_count integer;
begin
  v_requested_count := coalesce(cardinality(p_task_ids), 0);
  if v_requested_count = 0 then
    raise exception 'task_order_required' using errcode = '22023';
  end if;

  if (select count(*) from unnest(p_task_ids) as task_id) <> (select count(distinct task_id) from unnest(p_task_ids) as task_id) then
    raise exception 'duplicate_task_id' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.test_versions
    where id = p_test_version_id
      and lifecycle_status = 'draft'
  ) then
    raise exception 'draft_test_version_required' using errcode = '42501';
  end if;

  select count(*)
  into v_visible_count
  from public.tasks
  where test_version_id = p_test_version_id;

  if v_visible_count <> v_requested_count
     or exists (
       select 1
       from unnest(p_task_ids) as requested(task_id)
       where not exists (
         select 1
         from public.tasks t
         where t.id = requested.task_id
           and t.test_version_id = p_test_version_id
       )
     ) then
    raise exception 'task_order_mismatch' using errcode = '22023';
  end if;

  set constraints tasks_test_version_id_ordinal_key deferred;

  update public.tasks as t
  set ordinal = requested.ordinal::integer,
      updated_at = now()
  from unnest(p_task_ids) with ordinality as requested(task_id, ordinal)
  where t.id = requested.task_id
    and t.test_version_id = p_test_version_id;
end;
$$;

revoke all on function public.reorder_draft_tasks(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_draft_tasks(uuid, uuid[]) to authenticated, service_role;
