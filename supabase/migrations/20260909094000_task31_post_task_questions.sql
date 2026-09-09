-- Task 31: source-supported post-task question configuration.
-- REQUIRED product behavior: per-task SEQ + Open Feedback, each enabled/disabled and required/optional.
-- PROPOSED persistence mechanism: keep the two fixed V1 question toggles on the draft task row
-- so Task 32 can later snapshot the whole draft without inventing a second ordering model.

alter table public.tasks
  add column if not exists post_task_questions jsonb not null default
    '{"seq":{"enabled":false,"required":false},"open_feedback":{"enabled":false,"required":false}}'::jsonb;

alter table public.tasks
  drop constraint if exists tasks_post_task_questions_shape_ck;

alter table public.tasks
  add constraint tasks_post_task_questions_shape_ck check (
    jsonb_typeof(post_task_questions) = 'object'
    and post_task_questions ? 'seq'
    and post_task_questions ? 'open_feedback'
    and jsonb_typeof(post_task_questions -> 'seq') = 'object'
    and jsonb_typeof(post_task_questions -> 'open_feedback') = 'object'
    and jsonb_typeof(post_task_questions #> '{seq,enabled}') = 'boolean'
    and jsonb_typeof(post_task_questions #> '{seq,required}') = 'boolean'
    and jsonb_typeof(post_task_questions #> '{open_feedback,enabled}') = 'boolean'
    and jsonb_typeof(post_task_questions #> '{open_feedback,required}') = 'boolean'
    and not (
      (post_task_questions #>> '{seq,required}')::boolean
      and not (post_task_questions #>> '{seq,enabled}')::boolean
    )
    and not (
      (post_task_questions #>> '{open_feedback,required}')::boolean
      and not (post_task_questions #>> '{open_feedback,enabled}')::boolean
    )
  );

comment on column public.tasks.post_task_questions is
  'Task31 V1 fixed post-task question configuration. Keys: seq/open_feedback; each has enabled + required. Participant answer persistence is Task37.';
