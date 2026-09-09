# Task 27 — Project & Test CRUD

## Source-backed scope

Planning acceptance requires create/read/update/archive for `Project` and `Test` with permission and validation. The implementation uses the existing Task 20 schema and Task 21 workspace RLS/grants; it does not introduce a second authorization model.

## Authorization boundary

- Client sends the authenticated Supabase access token as `Authorization: Bearer <token>` to the Next.js API route.
- The server forwards that user JWT to Supabase Data API with the public anon key.
- The CRUD path never uses the service-role key, so Task 21 RLS and grants remain the authorization gate.
- Product Viewer write denial, researcher/designer edit access, and cross-workspace isolation therefore stay database-enforced.
- Provider/database error details are not echoed to the client.

## Endpoints

### Projects

- `GET /api/projects?workspaceId=<uuid>` — read workspace-visible projects.
- `POST /api/projects` — create with `{ workspaceId, name, description? }`.
- `GET /api/projects/:projectId` — read one visible project.
- `PATCH /api/projects/:projectId` — update `{ name?, description? }`.
- `PATCH /api/projects/:projectId` with `{ action: "archive" }` — archive without destructive delete.

### Tests

- `GET /api/tests?workspaceId=<uuid>&projectId=<uuid?>` — read workspace-visible tests, optionally scoped to one project.
- `POST /api/tests` — create with `{ workspaceId, projectId, title, description? }`; schema default keeps the new test in `draft`.
- `GET /api/tests/:testId` — read one visible test.
- `PATCH /api/tests/:testId` — update `{ title?, description? }`.
- `PATCH /api/tests/:testId` with `{ action: "archive" }` — archive without destructive delete.

## Validation and integrity

- Workspace/project/test identifiers must be UUIDs before provider calls.
- Project `name` and Test `title` must be non-empty, matching database constraints.
- Empty update bodies are rejected.
- Test/project tenant consistency is protected by the existing composite `tests_workspace_project_scope_fk` database constraint.
- Status transitions other than archive are intentionally not added here; publish/close/versioning remain separate planned builder tasks.

## Evidence boundary

This task does not invent an authenticated frontend session UX because the planning source does not define that interaction yet. The API/service boundary is ready for the Test Builder UI to consume once the authenticated application shell is wired. Task 27 should remain non-COMPLETE until branch QA passes and the remaining user-facing CRUD flow is verified against the planning/UI source.
