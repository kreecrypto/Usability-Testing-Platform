# FEAT-01.11 — Researcher workspace access and session recovery

Status: QA. Implementation and local automated QA pass; real-account Preview evidence remains open.

## Implemented scope

- Restored email/password login, account creation and password recovery as the entry to the protected researcher workspace.
- Added browser-bound PKCE callbacks, safe internal return URLs, HttpOnly access and refresh cookies, refresh rotation, local logout revocation and same-account reauthentication.
- Protected researcher pages retain mounted form state when a session expires. API calls retry only after refresh succeeds and never retry a failed write after an invalid refresh.
- Removed anonymous researcher identities. Public Demo remains synthetic, read-only and separate from researcher data.
- Connected session recovery to Projects, Builder, Results, Findings, Reports and Retest surfaces.
- Replaced internal-validation placeholder names with empty, user-authored workspace/project/test names and added plain-language guidance.

## Evidence on 1 October 2026

- `npm test`: 297/297 passing.
- `npm run typecheck`: passing.
- `npm run build`: passing.
- `npm run check:design-system`: passing.
- `npm run check:high-fi`: passing.
- Repository has no separate lint script.
- Local browser verification: Home exposes both authenticated researcher entry and read-only Demo. Login and signup forms render with semantic labels, 48px inputs, 44px actions and visible account alternatives.
- Supabase read-only audit: `workspaces`, `workspace_members`, `projects` and `tests` retain authenticated RLS policies. `create_owned_workspace` derives the owner from `auth.uid()`, grants no anonymous execution and remains executable by authenticated users only.
- Supabase security advisor reports no missing-policy finding for researcher workspace tables. Existing INFO findings concern server-only ingestion tables; leaked-password protection remains a project-level warning.

## Release evidence still required

Use an authorized researcher account on the Vercel Preview to verify email confirmation, password recovery, refresh, logout and the full create workspace → project → test path. Confirm that the deployed callback URL is in the Supabase Auth redirect allowlist. Until those checks pass, keep status at QA/BLOCKED_EXTERNAL and do not mark COMPLETE or deploy Production.
