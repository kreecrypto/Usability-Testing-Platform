-- Task 37: idempotent participant post-task answer persistence.
-- External evidence used only to close the scale SOURCE GAP: the standard SEQ is
-- a 7-point post-task ease rating. Stored value includes scaleVersion so later
-- analytics never silently invert or reinterpret the raw number.

alter table public.task_sessions
  add column if not exists feedback_submitted_at timestamptz;

create unique index if not exists answers_session_task_question_uq
  on public.answers (session_id, task_id, question_key)
  where task_id is not null;

create or replace function public.save_post_task_feedback(
  p_session_id uuid,
  p_task_id uuid,
  p_seq integer default null,
  p_open_feedback text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_task public.tasks%rowtype;
  v_config jsonb;
  v_seq_enabled boolean;
  v_seq_required boolean;
  v_open_enabled boolean;
  v_open_required boolean;
  v_open_value text;
begin
  select * into v_session from public.sessions where id = p_session_id;
  if v_session.id is null or v_session.status <> 'active' then
    raise exception 'active_session_required' using errcode = '22023';
  end if;

  select t.* into v_task
  from public.tasks t
  where t.id = p_task_id
    and t.test_version_id = v_session.test_version_id;
  if v_task.id is null then
    raise exception 'task_not_in_session_version' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.task_sessions ts
    where ts.session_id = p_session_id and ts.task_id = p_task_id and ts.outcome is not null
  ) then
    raise exception 'terminal_task_outcome_required' using errcode = '22023';
  end if;

  v_config := v_task.post_task_questions;
  v_seq_enabled := coalesce((v_config #>> '{seq,enabled}')::boolean, false);
  v_seq_required := coalesce((v_config #>> '{seq,required}')::boolean, false);
  v_open_enabled := coalesce((v_config #>> '{open_feedback,enabled}')::boolean, false);
  v_open_required := coalesce((v_config #>> '{open_feedback,required}')::boolean, false);
  v_open_value := nullif(trim(coalesce(p_open_feedback, '')), '');

  if v_seq_required and p_seq is null then raise exception 'seq_required' using errcode = '22023'; end if;
  if not v_seq_enabled and p_seq is not null then raise exception 'seq_disabled' using errcode = '22023'; end if;
  if p_seq is not null and (p_seq < 1 or p_seq > 7) then raise exception 'seq_out_of_range' using errcode = '22023'; end if;
  if v_open_required and v_open_value is null then raise exception 'open_feedback_required' using errcode = '22023'; end if;
  if not v_open_enabled and v_open_value is not null then raise exception 'open_feedback_disabled' using errcode = '22023'; end if;

  if v_seq_enabled and p_seq is not null then
    insert into public.answers (workspace_id, session_id, task_id, question_key, answer_type, value)
    values (
      v_session.workspace_id,
      p_session_id,
      p_task_id,
      'seq',
      'seq',
      jsonb_build_object(
        'response', p_seq,
        'scaleVersion', 'seq-7pt-v1',
        'lowAnchor', 'very_difficult',
        'highAnchor', 'very_easy'
      )
    )
    on conflict (session_id, task_id, question_key) where task_id is not null
    do update set value = excluded.value;
  end if;

  if v_open_enabled and v_open_value is not null then
    insert into public.answers (workspace_id, session_id, task_id, question_key, answer_type, value)
    values (v_session.workspace_id, p_session_id, p_task_id, 'open_feedback', 'text', to_jsonb(v_open_value))
    on conflict (session_id, task_id, question_key) where task_id is not null
    do update set value = excluded.value;
  end if;

  -- Submission is a task-session lifecycle fact, not a fabricated answer. This
  -- marker lets recovery distinguish an optional blank submission from a task
  -- that has not reached P06 yet and prevents duplicate completion transitions.
  update public.task_sessions
  set feedback_submitted_at = coalesce(feedback_submitted_at, now()),
      updated_at = now()
  where session_id = p_session_id
    and task_id = p_task_id;
end;
$$;

revoke all on function public.save_post_task_feedback(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.save_post_task_feedback(uuid, uuid, integer, text) to service_role;
