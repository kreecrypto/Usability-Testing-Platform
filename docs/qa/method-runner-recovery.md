# FEAT-13.02 / FEAT-13.04 — Method runner recovery

Manual PM round 2 repair, based on full-release candidate #141. This does not close live-account QA or FEAT-13.07 / MAJOR-A/B/C release gates.

## Defects and changes

- Tree final answer previously recomputed elapsed time on retry. After a saved response followed by completion failure/lost acknowledgement, the changed retry conflicted with immutable saved evidence. Freeze the first final submission (including path, trace and duration); navigation remains disabled while retrying the selected answer. Conflicting retries are still rejected server-side.
- Reload previously rendered no activity when every block had a response but session completion failed. GET progress remains read-only. The runner explicitly POSTs `{ "action": "recover_completion" }` to the existing version-scoped responses endpoint. The store verifies every exact published block has valid persisted answers before retrying completion. Completed recovery is idempotent; missing/foreign/invalid evidence and inactive terminal sessions fail closed. Existing session-proof verification applies; unknown action values return 400. All POST submissions additionally use the existing exact-origin policy: reject mismatched Origin or Sec-Fetch-Site cross-site before database access; missing Origin retains the existing trusted-client policy. No answer keys or saved response payloads are exposed.
- Clearing a Survey scale previously converted the empty placeholder to numeric zero. Empty now removes that answer, preserving optional No Data and required validation; choosing an actual zero remains valid for scales starting at zero.

## QA

- `npm test`: 334/334 PASS, including 11 new regression tests for Tree completion failure/lost insert acknowledgement, frozen duration/conflicting retries, reload/read-only progress/explicit recovery, incomplete/invalid/foreign evidence, scale clear for 0 and 1 minimum with required/optional questions, recovery session proof/unknown action rejection, forged same-site Origin rejection before data access, cross-site rejection, valid same-origin recovery and policy-compatible missing Origin. Independent QA initially found the origin gap in b8bcf9e; this follow-up repairs it and requires reviewer rerun.
- `npm run typecheck`: PASS after installing the existing lockfile with `npm ci --ignore-scripts` (initial check had no installed tsc).
- `npm run build`: PASS.
- `npm run check:design-system`, `npm run check:high-fi`: PASS.
- No lint script exists; no lint pass claimed. Tests use mocked transport, not a real Supabase/account. Preview and independent reviewer verification remain required.

No schema/migration, dependency, Auth/RLS relaxation, production writes or deployment. Unsubmitted answers are not persisted across browser reload; only already saved blocks are recovered.
