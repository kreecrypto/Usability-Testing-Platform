-- Tasks 50-51: make the V1 finding record satisfy the canonical Finding contract
-- without introducing an external ticketing provider.

alter table public.findings
  add column problem text,
  add column task_id uuid,
  add column screen_id text,
  add column metric_snapshot jsonb not null default '{}'::jsonb;

update public.findings
set problem = coalesce(nullif(trim(description), ''), title)
where problem is null;

alter table public.findings
  alter column problem set not null,
  add constraint findings_problem_nonempty check (length(trim(problem)) > 0),
  add constraint findings_screen_id_nonempty check (screen_id is null or length(trim(screen_id)) > 0),
  add constraint findings_metric_snapshot_object check (jsonb_typeof(metric_snapshot) = 'object'),
  add constraint findings_workspace_version_task_scope_fk
    foreign key (workspace_id, test_version_id, task_id)
    references public.tasks (workspace_id, test_version_id, id);

-- Evidence was originally globally keyed. Carry workspace_id on the evidence row
-- so tenant consistency is structural and does not depend on RLS alone.
alter table public.finding_evidence
  add column workspace_id uuid,
  add column evidence_type text,
  add column evidence_payload jsonb not null default '{}'::jsonb;

update public.finding_evidence fe
set workspace_id = f.workspace_id,
    evidence_type = case
      when fe.event_id is not null then 'event'
      when fe.answer_id is not null then 'answer'
      else 'session'
    end
from public.findings f
where f.id = fe.finding_id;

alter table public.events
  add constraint events_workspace_event_id_uq unique (workspace_id, event_id);

alter table public.answers
  add constraint answers_workspace_answer_id_uq unique (workspace_id, id);

alter table public.finding_evidence
  alter column workspace_id set not null,
  alter column evidence_type set not null,
  add constraint finding_evidence_workspace_finding_scope_fk
    foreign key (workspace_id, finding_id)
    references public.findings (workspace_id, id),
  add constraint finding_evidence_workspace_session_scope_fk
    foreign key (workspace_id, session_id)
    references public.sessions (workspace_id, id),
  add constraint finding_evidence_workspace_event_scope_fk
    foreign key (workspace_id, event_id)
    references public.events (workspace_id, event_id),
  add constraint finding_evidence_workspace_answer_scope_fk
    foreign key (workspace_id, answer_id)
    references public.answers (workspace_id, id),
  add constraint finding_evidence_type_check
    check (evidence_type in ('session', 'event', 'answer', 'path', 'heatmap')),
  add constraint finding_evidence_payload_object
    check (jsonb_typeof(evidence_payload) = 'object'),
  add constraint finding_evidence_typed_reference_check
    check (
      (evidence_type = 'session' and session_id is not null)
      or (evidence_type = 'event' and session_id is not null and event_id is not null)
      or (evidence_type = 'answer' and session_id is not null and answer_id is not null)
      or (
        evidence_type in ('path', 'heatmap')
        and session_id is not null
        and evidence_payload <> '{}'::jsonb
      )
    );

create index findings_version_task_idx
  on public.findings (workspace_id, test_version_id, task_id, status);

create index finding_evidence_type_idx
  on public.finding_evidence (workspace_id, finding_id, evidence_type, created_at);
