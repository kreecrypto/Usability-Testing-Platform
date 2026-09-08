create extension if not exists pgcrypto;

-- Task 20: V1 database schema baseline.
-- Authorization policies are intentionally deferred to Task 21. RLS is enabled
-- here so newly exposed public tables fail closed until those policies exist.

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) > 0),
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  system_role text not null default 'member' check (system_role in ('owner', 'admin', 'member')),
  product_persona text check (product_persona in ('researcher', 'designer', 'product_viewer')),
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) > 0)
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(title)) > 0)
);

create table public.test_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'published', 'archived')),
  provider text not null default 'figma' check (provider in ('figma')),
  figma_file_key text,
  figma_version_id text,
  figma_start_node_id text,
  prototype_mapping jsonb not null default '{}'::jsonb,
  event_schema_version text not null default 'v2',
  success_rule_version text,
  failure_rule_version text,
  timeout_seconds integer check (timeout_seconds is null or timeout_seconds > 0),
  abandonment_policy_version text,
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (test_id, version_no),
  check (
    lifecycle_status <> 'published'
    or (published_at is not null and figma_file_key is not null and figma_version_id is not null and figma_start_node_id is not null)
  )
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  test_version_id uuid not null references public.test_versions(id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  title text not null,
  scenario text,
  expected_path jsonb not null default '[]'::jsonb,
  success_rule jsonb not null default '{}'::jsonb,
  failure_rule jsonb not null default '{}'::jsonb,
  timeout_seconds integer check (timeout_seconds is null or timeout_seconds > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_version_id, ordinal),
  check (length(trim(title)) > 0)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  anonymous_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (test_id, anonymous_key)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  test_version_id uuid not null references public.test_versions(id) on delete restrict,
  participant_id uuid not null references public.participants(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned', 'technical_blocked')),
  consent_version text not null,
  consented_at timestamptz not null,
  locale text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  delete_after timestamptz,
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at)
);

create table public.task_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  outcome text check (outcome in ('success_direct', 'success_indirect', 'failed', 'give_up', 'timeout', 'abandoned', 'technical_blocked')),
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, task_id),
  check (ended_at is null or ended_at >= started_at)
);

create table public.events (
  event_id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  idempotency_key text not null,
  event_name text not null,
  event_layer text not null check (event_layer in ('raw', 'derived')),
  source text not null,
  schema_version text not null default 'v2',
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  sequence bigint,
  payload jsonb not null default '{}'::jsonb,
  derived_from_event_ids uuid[] not null default '{}'::uuid[],
  rule_version text,
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key),
  check ((event_layer = 'raw' and sequence is not null) or event_layer = 'derived'),
  check ((event_layer = 'derived' and cardinality(derived_from_event_ids) > 0 and rule_version is not null) or event_layer = 'raw')
);

create unique index events_session_raw_sequence_uq
  on public.events (session_id, sequence)
  where event_layer = 'raw';

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  question_key text not null,
  answer_type text not null check (answer_type in ('seq', 'single_choice', 'multi_choice', 'text', 'number', 'boolean')),
  value jsonb not null,
  created_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  test_version_id uuid not null references public.test_versions(id) on delete restrict,
  title text not null,
  description text,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'fixed', 'retest_needed', 'verified', 'dismissed')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(title)) > 0)
);

create table public.finding_evidence (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  event_id uuid references public.events(event_id) on delete set null,
  answer_id uuid references public.answers(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check (session_id is not null or event_id is not null or answer_id is not null)
);

create table public.retests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete set null,
  original_test_version_id uuid not null references public.test_versions(id) on delete restrict,
  retest_test_version_id uuid not null references public.test_versions(id) on delete restrict,
  status text not null default 'planned' check (status in ('planned', 'running', 'passed', 'failed', 'cancelled')),
  before_metrics jsonb not null default '{}'::jsonb,
  after_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (original_test_version_id <> retest_test_version_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id, workspace_id);
create index projects_workspace_idx on public.projects (workspace_id, created_at desc);
create index tests_workspace_project_idx on public.tests (workspace_id, project_id);
create index test_versions_workspace_test_idx on public.test_versions (workspace_id, test_id, version_no desc);
create index tasks_workspace_version_idx on public.tasks (workspace_id, test_version_id, ordinal);
create index participants_workspace_test_idx on public.participants (workspace_id, test_id);
create index sessions_workspace_version_idx on public.sessions (workspace_id, test_version_id, started_at desc);
create index sessions_participant_idx on public.sessions (participant_id, started_at desc);
create index task_sessions_session_idx on public.task_sessions (session_id, started_at);
create index events_workspace_received_idx on public.events (workspace_id, received_at desc);
create index events_session_occurred_idx on public.events (session_id, occurred_at, received_at);
create index answers_workspace_session_idx on public.answers (workspace_id, session_id, created_at);
create index findings_workspace_project_idx on public.findings (workspace_id, project_id, status);
create index finding_evidence_finding_idx on public.finding_evidence (finding_id, created_at);
create index retests_workspace_finding_idx on public.retests (workspace_id, finding_id, created_at desc);

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.tests enable row level security;
alter table public.test_versions enable row level security;
alter table public.tasks enable row level security;
alter table public.participants enable row level security;
alter table public.sessions enable row level security;
alter table public.task_sessions enable row level security;
alter table public.events enable row level security;
alter table public.answers enable row level security;
alter table public.findings enable row level security;
alter table public.finding_evidence enable row level security;
alter table public.retests enable row level security;
