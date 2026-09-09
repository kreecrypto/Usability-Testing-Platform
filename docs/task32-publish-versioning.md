# Task 32 — Preview, Publish & Test Versioning

## Scope

Task 32 turns the current Builder draft into one deterministic internal `test_version` snapshot. It does not reintroduce Researcher OAuth or require a Figma REST file-version id.

A publishable simplified-V1 snapshot binds:

- the exact validated public Figma prototype `sourceUrl`;
- the exact normalized `embedUrl`;
- the Figma file key;
- the canonical prototype start node;
- the ordered version-scoped task rows, including scenario, participant instruction, expected path, success/failure rules, timeout and post-task question configuration;
- event/rule/abandonment contract versions stored on the internal test version.

## Deterministic preview

`GET /api/tests/:testId/publish` reads exactly one latest visible draft or published internal version through the current authenticated user JWT and Supabase RLS. Tasks are read from that version and ordered by `ordinal`.

The review surface is `/builder/:testId/review`.

## Publish boundary

`POST /api/tests/:testId/publish` with `{ "action": "publish" }` calls the `SECURITY INVOKER` database RPC `publish_draft_test_version`.

The database rejects publish when there is no draft, no validated prototype snapshot/start node, or no task. Publishing sets the internal lifecycle to `published`, records `published_at`, and marks the test as published in one database transaction.

The previous baseline check that required `figma_version_id` is replaced because simplified V1 explicitly does not require Figma REST version metadata. `figma_version_id` remains null on this path.

## Immutability

Database triggers reject update/delete of a published `test_versions` row and reject insert/update/delete of tasks belonging to a published version. This keeps historical sessions resolvable against the exact version id they started with.

Editing after publish uses `{ "action": "create_draft" }`, which calls `create_draft_from_published`. The RPC reuses an existing draft if one exists; otherwise it clones the latest published prototype/config and all ordered tasks into the next internal version number. The published source rows are never edited.

## Security boundary

- Builder API uses the current Researcher user JWT plus publishable Supabase key.
- Existing RLS remains authoritative for test/version/task visibility and mutation.
- No service-role key is sent to or required by the Builder client.
- RPC execution is denied to `anon` and allowed only to `authenticated` and server-side `service_role`.

## QA contract

Task 32 QA must prove:

1. preview returns exact source URL, start node and ordered task configuration from one internal version;
2. publish uses the atomic RPC and rejects incomplete drafts;
3. published version and its task rows cannot be mutated;
4. edit-after-publish creates/reuses a newer draft without altering historical rows;
5. no Figma REST version-id dependency is added;
6. Build, schema and authorization regression suites remain green.
