# V1 Screen Inventory

The inventory maps directly to `docs/user-flows.md` and is the input to low-fidelity wireframes.

> Current build decision (2026-09-10): Researcher login UI is deferred and must not be surfaced yet. Supabase Auth/RLS and server authorization remain implemented for later activation. S01 is therefore an unauthenticated App Entry review state, not a sign-in form.

## Researcher app

| ID | Screen | Required states |
| --- | --- | --- |
| S01 | App Entry | default, loading, error |
| S02 | Create Workspace | default, validation, loading, error |
| S03 | Home | default, empty, loading, error |
| S04 | Projects Index | default, empty, search/filter, loading, error |
| S05 | Create Project | default, validation, loading, error |
| S06 | Project Overview | default, empty tests/findings, loading |
| S07 | Tests Index | draft/published/closed filters, empty, loading |
| S08 | Create Test | type selection, validation, loading |
| S09 | Test Build Workspace | draft, incomplete, validating, ready, restricted |
| S10 | Figma Connect / Import | empty, connecting, invalid URL, auth error |
| S11 | Figma Access Preflight | pass, login required, password, provider error |
| S12 | Prototype / Start Point | loading, selected, missing start, unsupported |
| S13 | Task Editor | default, validation, multiple tasks, reorder |
| S14 | Success / Failure Rules | direct/failure/timeout, missing/conflict |
| S15 | Question Editor | SEQ, open feedback, required/optional, validation |
| S16 | Build Validation Summary | pass, warning, publish blocked |
| S17 | Preview Setup | ready, invalid draft, provider blocked |
| S18 | Preview Runner | running, simulation, error, exit |
| S19 | Publish Checklist | checking, pass, blocked, version changed |
| S20 | Share / Published | published, copy link, closed, new version |
| S21 | Results Index | default, empty, loading, filter |
| S22 | Results Overview | no data, partial, ready, technical warning |
| S23 | Task Detail | ready, low sample, no eligible sessions |
| S24 | Path Analysis | expected/actual, no data, unsupported evidence |
| S25 | Heatmap | ready, no clicks, unsupported transform/provider, filtered |
| S26 | Sessions List | ready, empty, restricted, filter |
| S27 | Session Detail | timeline, redacted, evidence deleted, technical blocked |
| S28 | Findings List | empty, open, resolved, filter |
| S29 | Finding Detail / Editor | create, edit, evidence linked/deleted |
| S30 | Retest Comparison | no baseline, ready, low sample, technical context |
| S31 | Participants / Sessions | default, restricted, empty, search |
| S32 | Delete Data | confirm scope, processing, complete, error |
| S33 | Workspace Settings | default, permission denied |
| S34 | Members & Roles | default, invite/edit, restricted |
| S35 | Integrations / Figma | disconnected, connecting, connected, error |
| S36 | Privacy & Retention | default 90d, change pending, validation, restricted |

## Public participant runner

| ID | Screen | Required states |
| --- | --- | --- |
| P01 | Access Check | loading, valid |
| P02 | Consent | default, accepting, declined |
| P03 | Task Intro | default, multi-task progress |
| P04 | Prototype Runner | running, buffering, provider loading |
| P05 | Give Up Confirmation | confirm, cancel |
| P06 | Post-task Feedback | SEQ, open feedback, validation |
| P07 | Next Task Transition | ready, loading |
| P08 | Complete / Thank You | complete |
| P09 | Invalid / Closed Link | invalid, expired, closed |
| P10 | Technical Blocked | login required, password, permission, provider error |
| P11 | Timeout | timed out, continue per study config |
| P12 | Recovery / Resume | reconnect, resume success, resume failed |

## Global states required in wireframes and high-fi

- loading/skeleton
- empty
- error
- permission denied/restricted
- disabled CTA
- keyboard focus
- inline + summary validation
- mobile responsive
- low/no-data confidence
- technical-blocked operational warning
- evidence deleted/redacted privacy state

## Flow mapping

- Researcher R1-R10 -> S03-S30
- Participant P1-P8 -> P01-P08
- Participant exceptions -> P09-P12
- Privacy operations -> S31-S36

Every analytics screen must define Empty/Unsupported/Restricted behavior where relevant, and every publish path must define Validation/Blocked behavior.
