# Participant recovery regression — 2026-09-26

Status: QA. This is a regression repair under the Participant Runner scope; not release approval.

Baseline: main 878ab8488f14f086075b94ab685bf5b4a98632db. Planning source: current UTP Task List, Participant Runner and multi-target QA gates. MT-09 remains IN_PROGRESS and subsequent gates are not marked complete.

Fixes:
- Bootstrap no longer depends on the snapshot it loads; recovery uses that exact loaded snapshot.
- Recovery validates both test and immutable version; subsequent state reads reject another session.
- Timeout uses the original task start, including recovery and give-up confirmation; reopening confirmation cannot extend the deadline.

Validation: npm ci, npm run qa passed (production build, typecheck, 267/267 tests). Three new regression cases cover version isolation, elapsed/expired deadlines, and invalid timing evidence. Design-system and high-fi checks passed. No lint script exists (TEST GAP).

Remaining: real mobile/desktop participant browser verification. No production participant evidence was fabricated. No deployment or production verification is claimed by this record.
