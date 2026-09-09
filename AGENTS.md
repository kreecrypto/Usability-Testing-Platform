# AGENTS.md — Usability Testing Platform

## 0. CURRENT OVERRIDES

These rules override older project notes, legacy docs, or prior chat assumptions when they conflict.

### Current Source of Truth

1. **Google Sheet — Usability Testing Platform — Task List**
   - https://docs.google.com/spreadsheets/d/1car-7heRkDkN2RBiJvD3qr8WlbS2rvFUYSepQS7ABOQ/edit
   - Product planning
   - Task
   - Execution order
   - Requirement
   - Dependency
   - Acceptance Criteria

2. **GitHub Repository**
   - `kreecrypto/Usability-Testing-Platform`
   - Source code
   - Architecture
   - Technical docs
   - Schema/migrations
   - Tests
   - QA scripts
   - Deployment code

3. **Vercel Runtime**
   - https://usability-testing-platform.vercel.app/
   - Runtime verification
   - Visual verification
   - Responsive behavior
   - Navigation/browser behavior
   - Production regression

4. **Official Vendor Docs**
   - Use only when provider/API capability matters, e.g. Figma, Supabase, Vercel.

### Deprecated / Superseded

- Notion is no longer the planning Source of Truth.
- Cloudflare is no longer the default infrastructure direction.
- Prefer **Vercel + Supabase** unless a current task explicitly requires otherwise.
- Do not reintroduce deprecated architecture from old documents without current task evidence.

---

## 1. PROJECT NORTH STAR

**Behavior → Evidence → UX Decision**

Core loop:

Build Test → Observe Behavior → Detect Friction → Create Finding → Fix → Retest

Every feature, architecture decision, metric, IA, UX flow, and implementation should support this loop.

Do not turn the product into a generic analytics dashboard.

---

## 2. V1 SCOPE

### Project & Test
- Project Management
- Test Management
- Test Version
- Draft / Published State

### Prototype
- Figma Prototype Import
- Figma Embed
- Prototype Start Point
- Frame Mapping

### Test Builder
- Task Builder
- Scenario Builder
- Success Rule
- Failure Rule
- Give-up Rule
- Timeout Rule

### Participant
- Public participant link
- No account required
- Consent
- Anonymous session
- Task instructions
- Prototype runner
- Post-task feedback

### Tracking
- Event tracking
- Task start/end
- Success / Failure / Give-up / Timeout / Abandoned
- Click / Misclick
- Navigation path

### Analytics
- Completion rate
- Time on task: Median primary, P75/P90 secondary
- Misclick rate
- Give-up rate
- Drop-off
- Funnel
- User path
- Detour
- Backtracking
- Heatmap
- Session timeline
- SEQ

### Findings / Retest
- Finding
- Severity
- Evidence
- Session evidence
- Metric evidence
- UX recommendation
- Retest version
- Compare cohorts
- Before / after
- Retest delta

### Out of Scope — V1
Do not add automatically:
- Participant recruitment marketplace
- Moderated interview
- Research repository
- Full survey builder
- Card sorting
- Tree testing
- Enterprise SSO
- AI moderator

Classify unsupported additions as `FUTURE / V2`.

---

## 3. NO-GUESS RULE

**Do not guess.**

Before modifying an existing system, inspect the actual source.

Evidence order:

Google Sheet → GitHub → Code → Documentation → Production → QA Evidence → Official Vendor Docs when needed

If evidence is missing, classify it as:

`SOURCE GAP`

For new solutions not currently required, label them:

`PROPOSED`

Always distinguish:
- `EXISTING`
- `REQUIRED`
- `PROPOSED`
- `GAP`

Do not present proposals as existing requirements.

---

## 4. CURRENT ARCHITECTURE DIRECTION

### Frontend
- Next.js
- React
- TypeScript

### Database / Auth
- Supabase PostgreSQL
- Supabase Auth where applicable

### Hosting
- Vercel

### Prototype Integration
- Figma Embed
- Figma OAuth only when a current requirement actually needs authenticated Figma access

### Guardrail
Do not introduce Cloudflare Worker/R2, alternative databases, or new infra providers unless the current executable task explicitly requires them.

Prefer the simplest implementation that satisfies current requirements.

---

## 5. SYSTEM BOUNDARIES

### Researcher Application
Projects, Tests, Prototype, Tasks, Rules, Preview, Publish, Results, Sessions, Analytics, Findings, Retest.

### Participant Runner
Public Link → Consent → Anonymous Session → Task → Prototype → Behavior Tracking → Task Result → SEQ → Feedback → Next Task / Finish

Participant must not see:
- Expected path
- Success target
- Internal analytics
- Researcher notes

### Event Collection
Must preserve:
- Payload validation
- Retry safety
- Idempotency
- Duplicate prevention
- No silent event loss after acceptance

### Analytics
Principle:

Raw Event → Deterministic Derivation → Metric → Finding

Metrics must be reproducible from evidence.

### Findings & Retest
A finding should support:
- Problem
- Evidence
- Affected task
- Affected participants
- Severity
- Metric impact
- Recommended fix
- Retest status

---

## 6. EVENT / METRIC INVARIANTS

Accepted events:
- No silent loss
- No duplicate counting

Each task execution must resolve deterministically to one terminal state, e.g.:
- Success
- Failed
- Give-up
- Timeout
- Abandoned
- Technical Block

Do not count one task execution in multiple terminal states.

Completion:

`Eligible = Started - Technical Blocked`

Technical Block is not automatically usability failure.

No Data ≠ 0.

If no eligible sample exists, use N/A / No eligible data / Unavailable as appropriate.

Published test versions are immutable:

Published → Create New Draft → Edit → Validate → Publish New Version

Historical sessions must retain the exact test version used.

---

## 7. PRIVACY / ACCESSIBILITY / RESPONSIVE

Behavioral tracking requires consent.

Default:
- Anonymous participant
- Minimal PII
- Data retention rules
- Delete participant/session data support

Screen recording, microphone, camera, or voice require separate explicit consent.

Participant Runner responsive support is P0.

Verify at least:
- Mobile
- Desktop

Accessibility checks where relevant:
- Keyboard navigation
- Focus indicator
- Contrast
- Screen-reader labels
- Form errors
- Touch targets
- Semantic structure

Core-flow accessibility failures are release blockers.

---

## 8. TASK EXECUTION SYSTEM

For every task:

READ SOURCE
→ INSPECT CURRENT STATE
→ IDENTIFY TASK
→ CHECK DEPENDENCY
→ IMPLEMENT
→ QA
→ FIX
→ RE-QA
→ UPDATE STATUS
→ NEXT TASK

Do not skip QA.

Do not assume the current task from chat memory.

Always refresh the current task source first.

### Task Status
Use only:
- IN_PROGRESS
- QA
- TODO_EXECUTABLE
- BLOCKED_SELF_FIXABLE
- BLOCKED_EXTERNAL
- TODO_DEPENDENCY_BLOCKED
- COMPLETE

### Priority when asked to do all tasks
1. IN_PROGRESS
2. QA
3. P0 TODO_EXECUTABLE
4. P1 TODO_EXECUTABLE
5. P2 TODO_EXECUTABLE
6. BLOCKED_SELF_FIXABLE
7. Recheck dependency
8. Next executable task

Skip BLOCKED_EXTERNAL and continue other executable work.

Do not stop the entire queue because one task is blocked.

---

## 9. BLOCKER RULES

### BLOCKED_SELF_FIXABLE
If it can be solved through code, config, schema, migration, docs, tests, repo changes, deployment, or connected tools, attempt the fix before asking the user.

### BLOCKED_EXTERNAL
Use only for truly unavailable input, such as:
- Missing credential
- External approval
- Billing
- Account-owner action
- Missing external source evidence
- Physical device/hardware action

Report:
- Blocker
- Why blocked
- Required input
- What can continue meanwhile

---

## 10. IMPLEMENT / QA / DEPLOY

### Implement
1. Inspect existing source
2. Identify affected files/components
3. Implement
4. Run relevant checks
5. Fix failures
6. Verify changed behavior
7. Report actual evidence

Do not return only recommendations when implementation is possible.

### QA
Check actual implementation. Where relevant:
- Functional
- Visual
- Responsive
- State
- Error
- Empty
- Regression
- Data QA
- Event QA
- Metric reproducibility QA

### Deploy
Source → Build → Test → Commit → Deploy → Production Verification

Deploy success alone does not mean task complete.

---

## 11. EVIDENCE RULE

Claims such as Done, Fixed, Complete, Pass, Production Ready require evidence.

Evidence can include:
- Source code/diff
- Test result
- Typecheck/lint result
- Build result
- Browser verification
- Screenshot
- Production URL
- Query result
- Metric reproduction

No evidence = do not declare COMPLETE.

Before finishing an implementation task, inspect repository scripts and run relevant supported checks such as:
- Typecheck
- Lint
- Unit tests
- Integration tests
- Production build
- Targeted regression tests

If a test/check does not exist, report `TEST GAP` rather than pretending it passed.

---

## 12. SUPABASE RULE

Before schema changes:
1. Inspect schema
2. Inspect migrations
3. Inspect FK/dependencies
4. Inspect application queries
5. Inspect RLS/policies where applicable
6. Plan migration
7. Apply safely
8. Verify application behavior
9. Verify data assumptions

Never expose service-role credentials to client code.

Avoid destructive production data changes unless explicitly required and supported by evidence.

---

## 13. GITHUB / CODEX WORKER RULE

Repository: `kreecrypto/Usability-Testing-Platform`

Default branch: `main`

For concurrent Codex work:
- One task = one branch/worktree
- Do not let multiple workers edit `main` simultaneously
- Keep commits task-scoped
- Avoid unrelated refactors

Suggested branch format:
- `codex/task-<TASK_ID>`
- `codex/w1-<TASK_ID>`
- `codex/w2-<TASK_ID>`
- `codex/w3-<TASK_ID>`
- `codex/w4-<TASK_ID>`
- `codex/w5-<TASK_ID>`

Do not fabricate task IDs.

Before parallelizing:
1. Read executable task list
2. Check dependency graph
3. Identify shared files/schema/contracts
4. Parallelize only non-conflicting tasks
5. Use separate branch/worktree per worker
6. Run worker-local QA
7. Integrate after worker QA passes
8. Run integration/regression QA after merge

Suggested worker domains are guidance only; the current task list remains authoritative:
- W1: Core app / Auth / Project-Test foundation
- W2: Test Builder / Prototype / Figma
- W3: Participant Runner / Tracking
- W4: Analytics / Findings / Retest
- W5: QA / Integration / UX / Accessibility / Regression

---

## 14. CHANGE-SCOPE RULE

For each task:
- Change only files required by the task
- Do not refactor unrelated areas
- Do not change architecture without requirement evidence
- Do not casually change public contracts
- Do not change DB schema without migration/dependency review
- Preserve compatible existing behavior where required

If broader change is required, document why with evidence.

---

## 15. TASK START CHECKLIST

Before coding, identify:
- Task ID
- Task Name
- Current Status
- Priority
- Requirement Source
- Dependencies
- Acceptance Criteria
- Relevant repo files
- Existing tests
- Runtime area affected
- Risk
- Shared-file conflict risk

If acceptance criteria are missing, classify that gap rather than guessing.

---

## 16. TASK COMPLETION CHECKLIST

A task can be COMPLETE only when:
- Requirement implemented
- Acceptance Criteria satisfied
- Relevant tests pass
- Build/checks pass
- Regression checked
- Runtime verified when applicable
- Evidence recorded
- No known Critical blocker remains

Otherwise keep it in QA or appropriate blocked state.

---

## 17. UX/UI REVIEW MODE

When asked to Review UXUI, inspect UX, UI, Content, Responsive and Accessibility.

Issue format:

`[Severity] [Screen/Node] Issue`

Include:
- Problem
- Why
- User Impact
- Evidence
- Proposed Solution
- Acceptance Criteria

Severity:
- Critical: core flow unusable / incorrect data / privacy or security risk
- High: important task failure or high misunderstanding risk
- Medium: clear friction but task remains achievable
- Low: polish / consistency / minor usability

---

## 18. RESPONSE FORMAT DURING EXECUTION

For every task report:

### Task
`Task ID + Name`

### Status
`IN_PROGRESS / QA / COMPLETE / BLOCKED_*`

### Source
Actual sources inspected.

### What I found
Current implementation/evidence.

### What changed
Actual modifications.

### QA
PASS / FAIL with evidence.

### Blocker
If any.

### Next
Next executable task.

Never say COMPLETE without evidence.

---

## 19. DEFAULT AUTONOMOUS BEHAVIOR

When the user gives a clear goal:

Inspect → Decide → Execute → QA

Do not ask questions that can be answered from available sources.

For minor ambiguity, choose the interpretation best supported by current Source of Truth.

For major source conflict, stop only the conflicting part, document it, and continue unrelated executable work.

When asked to do all tasks, refresh task source each execution cycle. Never hard-code a remembered current task.

---

## 20. CODEX SESSION START COMMAND

Read `AGENTS.md` completely before making changes.

Continue development of the Usability Testing Platform.

Read the current planning Source of Truth, inspect the repository, identify the next executable task, verify dependencies and Acceptance Criteria, implement only supported scope, run QA, fix failures, re-run QA, and report evidence.

Do not guess.
Do not use deprecated Notion/Cloudflare assumptions.
Do not change unrelated scope.
Do not declare COMPLETE without evidence.
Continue to the next executable task when the current task passes QA.

---

## 21. FINAL PRINCIPLE

Before every material decision, ask:

**Does this help the UX team identify usability problems from real behavior and transform them into Evidence → Finding → Fix → Retest?**

If not, challenge the requirement before adding complexity.
