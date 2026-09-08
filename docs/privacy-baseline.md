# V1 Privacy, Consent & Retention Baseline

This is a product/engineering data-minimization baseline, not legal advice.

## Consent

- Obtain consent before consent-dependent behavioral usability tracking begins.
- Consent disclosure covers task interactions, path, pointer evidence, duration, task outcome, SEQ, and open feedback.
- Persist `consentVersion`, `consentedAt`, locale, and `testVersionId`.
- Consent decline does not create an eligible usability task/session.
- Screen, microphone, camera, and voice recording are out of V1. Any later recording feature requires separate explicit consent.

## Anonymous participant identity

- Default identity is a random opaque identifier/UUID.
- Do not use device fingerprinting as participant identity.
- Participant account/login is not required.
- Do not expose participant identity across studies/workspaces without a documented need.

## PII minimization

- Tracking envelopes do not contain free-form PII fields.
- Names, emails, and phone numbers are not part of the canonical event envelope.
- Open feedback can contain incidental PII and is treated as restricted participant content.
- Product Viewer cannot access raw participant identifiers.
- Secrets/service credentials never enter participant event payloads.

## Retention

V1 default raw session/event/answer retention: **90 days after session completion**.

Future workspace configurability must remain subject to platform/organization limits.

Deletion or retention expiry must propagate to derived datasets that can identify or reconstruct the deleted session.

## Delete-data propagation

At minimum support:
1. delete one session
2. delete participant data within an authorized scope
3. delete test research data within an authorized scope

Deletion propagates to:
- raw events
- sessions/task sessions
- answers/open feedback
- participant identifiers
- heatmap/path/session-derived data
- cached/derived analytics attributable to the deleted session

Findings referencing deleted evidence must show evidence unavailable/deleted rather than retaining unnecessary PII snapshots.

## Access baseline

- Workspace isolation is enforced server-side and at the database authorization layer.
- Participant tokens grant only the minimum published-test/session access needed.
- Product Viewer is aggregate/read-only by default.
- Researcher/Designer session-level access is capability- and need-based.

## Operational logging

- Do not log complete event payloads, feedback, or PII by default.
- Use opaque IDs such as `sessionId`/`eventId` for tracing.
- Security/audit logs are separated from research-event data.

## Pre-production note

Formal legal/compliance review is a separate release activity. This document only defines the V1 product/engineering baseline.
