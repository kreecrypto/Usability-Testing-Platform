-- MAJOR-A / FP-01: authenticated zero-state workspace bootstrap.
-- Security invoker keeps RLS as the authorization boundary.
create or replace function public.create_owned_workspace(p_name text, p_slug text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if v_name = '' or length(v_name) > 120 then
    raise exception 'invalid_workspace_name' using errcode = '22023';
  end if;
  if v_slug = '' then
    v_slug := regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then v_slug := 'workspace'; end if;
    v_slug := left(v_slug, 48) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  else
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
  end if;
  if v_slug = '' or length(v_slug) > 64 then
    raise exception 'invalid_workspace_slug' using errcode = '22023';
  end if;

  insert into public.users(id) values (v_user_id)
  on conflict (id) do nothing;

  insert into public.workspaces(name, slug, owner_user_id)
  values (v_name, v_slug, v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members(workspace_id, user_id, system_role)
  values (v_workspace_id, v_user_id, 'owner');

  return v_workspace_id;
end;
$$;

revoke all on function public.create_owned_workspace(text,text) from public, anon;
grant execute on function public.create_owned_workspace(text,text) to authenticated;
comment on function public.create_owned_workspace(text,text) is
  'MAJOR-A authenticated zero-state workspace bootstrap. RLS remains authoritative.';
