-- Run against a disposable database after applying all migrations.
-- Requires Supabase-compatible anon/authenticated/service_role roles and auth.uid().
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.users(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.workspaces(id,name,slug,owner_user_id) values
  ('22222222-2222-4222-8222-222222222222','QA','feat13-qa','11111111-1111-4111-8111-111111111111');
insert into public.workspace_members(workspace_id,user_id,system_role,product_persona) values
  ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','owner','researcher');
insert into public.projects(id,workspace_id,name) values
  ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','QA');
insert into public.tests(id,workspace_id,project_id,title) values
  ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Method QA');
insert into public.test_versions(id,workspace_id,test_id,version_no,study_mode,invite_only,screener_config) values
  ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',1,'methods',true,
  '{"questions":[{"id":"q1","prompt":"Role?","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"}],"accept":["yes"]}]}');
insert into public.study_blocks(id,workspace_id,test_version_id,ordinal,kind,title,config) values
  ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555',1,'survey','Question',
  '{"questions":[{"id":"q1","prompt":"Hello?","type":"text","required":true}]}');
select public.publish_draft_test_version('44444444-4444-4444-8444-444444444444');

do $$ begin
  begin
    perform * from public.create_anonymous_participant_session('55555555-5555-4555-8555-555555555555','utp-privacy-v1','th');
    raise exception 'legacy session entry accepted method study';
  exception when sqlstate '22023' then null;
  end;
  begin
    update public.study_blocks set title='Mutated' where id='66666666-6666-4666-8666-666666666666';
    raise exception 'published block was mutable';
  exception when sqlstate '55000' then null;
  end;
end $$;

insert into public.study_invites(id,workspace_id,test_version_id,label,token_hash,expires_at) values
  ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555','Accepted',repeat('a',64),now()+interval '1 day'),
  ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555','Rejected',repeat('b',64),now()+interval '1 day');
select * from public.start_method_participant_session('55555555-5555-4555-8555-555555555555',repeat('a',64),'{"q1":"yes"}','utp-privacy-v1','th');
select * from public.start_method_participant_session('55555555-5555-4555-8555-555555555555',repeat('b',64),'{"q1":"no"}','utp-privacy-v1','th');

do $$
declare v_session_id uuid;
begin
  select used_session_id into v_session_id from public.study_invites where id='77777777-7777-4777-8777-777777777777';
  if v_session_id is null then raise exception 'accepted invite did not start a session'; end if;
  if (select status from public.study_invites where id='88888888-8888-4888-8888-888888888888') <> 'rejected' then
    raise exception 'ineligible invite was not consumed';
  end if;
  begin
    perform * from public.start_method_participant_session('55555555-5555-4555-8555-555555555555',repeat('a',64),'{}','utp-privacy-v1','th');
    raise exception 'reused invite was accepted';
  exception when sqlstate '22023' then null;
  end;
  insert into public.study_responses(workspace_id,test_version_id,session_id,block_id,response,started_at) values
    ('22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555',v_session_id,
     '66666666-6666-4666-8666-666666666666','{"answers":{"q1":"hello"}}',now());
  begin
    insert into public.study_responses(workspace_id,test_version_id,session_id,block_id,response,started_at) values
      ('22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555',v_session_id,
       '66666666-6666-4666-8666-666666666666','{"answers":{"q1":"duplicate"}}',now());
    raise exception 'duplicate response was accepted';
  exception when unique_violation then null;
  end;
end $$;

set local role anon;
do $$ begin
  if (select has_table_privilege('anon','public.study_responses','select')) then raise exception 'anon can read responses'; end if;
  if (select has_function_privilege('anon','public.start_method_participant_session(uuid,text,jsonb,text,text)','execute')) then
    raise exception 'anon can execute invitation RPC';
  end if;
end $$;
reset role;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111"}';
set local role authenticated;
do $$ begin
  if (select count(*) from public.study_blocks) <> 1 then raise exception 'researcher cannot read study blocks'; end if;
  if (select count(*) from public.study_responses) <> 1 then raise exception 'researcher cannot read method evidence'; end if;
  if has_table_privilege('authenticated','public.study_responses','insert') then raise exception 'researcher can insert responses directly'; end if;
end $$;
do $$
declare v_finding_id uuid;
begin
  select public.create_method_finding(
    '55555555-5555-4555-8555-555555555555', sr.id,
    'Method observation', 'Participant was confused', 'Observed hesitation',
    'Clarify the label', 'medium') into v_finding_id
  from public.study_responses sr limit 1;
  if v_finding_id is null or
    (select count(*) from public.finding_evidence where finding_id = v_finding_id) <> 1 or
    (select metric_snapshot->>'sampleSize' from public.findings where id = v_finding_id) <> '1' then
    raise exception 'method finding was not created atomically with evidence and real count';
  end if;
  begin
    perform public.create_method_finding(
      '55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Invalid evidence', 'Must reject', null, null, 'low');
    raise exception 'finding accepted missing response';
  exception when sqlstate '42501' then null;
  end;
  if (select count(*) from public.findings) <> 1 then raise exception 'invalid evidence left orphan finding'; end if;
end $$;
reset role;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
set local role authenticated;
do $$ begin
  if (select count(*) from public.study_blocks) <> 0 then raise exception 'other user can read study blocks'; end if;
  if (select count(*) from public.study_responses) <> 0 then raise exception 'other user can read method evidence'; end if;
end $$;
reset role;
set local request.jwt.claim.sub = '';
set local "request.jwt.claims" = '';
do $$
declare v_new_version uuid;
declare v_session uuid;
begin
  v_new_version := public.create_draft_from_published('44444444-4444-4444-8444-444444444444');
  if (select count(*) from public.study_blocks where test_version_id=v_new_version) <> 1 then
    raise exception 'published method block was not copied into draft';
  end if;
  if (select count(*) from public.study_blocks where test_version_id='55555555-5555-4555-8555-555555555555') <> 1 then
    raise exception 'published method block changed during clone';
  end if;
  select used_session_id into v_session from public.study_invites where id='77777777-7777-4777-8777-777777777777';
  delete from public.sessions where id=v_session;
  if (select count(*) from public.study_responses where session_id=v_session) <> 0 then
    raise exception 'session deletion retained method responses';
  end if;
  if (select count(*) from public.study_invites where id='77777777-7777-4777-8777-777777777777') <> 0 then
    raise exception 'session deletion retained redeemed invite';
  end if;
end $$;
rollback;
