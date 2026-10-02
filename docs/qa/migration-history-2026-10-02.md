# Migration history audit — 2 October 2026

Read-only audit of Supabase migration history. No migration or history repair has been applied to Production. Exact-byte mismatch does not prove semantic SQL drift; it requires statement-level comparison before repair. Names alone are not equivalence evidence.

| Stored version/name | Repository match | Exact SQL hash |
|---|---|---|
| 20260909002209 / initial_v1_schema | 20260908141723_initial_v1_schema.sql | DIFF |
| 20260909002221 / contract_integrity_fixes | 20260908154500_contract_integrity_fixes.sql | DIFF |
| 20260909002607 / task21_workspace_auth_rls | 20260908165429_task21_workspace_auth_rls.sql | DIFF |
| 20260909031311 / task24_retention_archiving | 20260909033000_task24_retention_archiving.sql | DIFF |
| 20260909032759 / gwd08_grants_rls_views_hardening | 20260909032000_gwd08_grants_rls_views_hardening.sql | DIFF |
| 20260909032803 / gwd07_event_dlq | 20260909034500_gwd07_event_dlq.sql | DIFF |
| 20260909032845 / gwd08_private_acl_fix | none | no named file |
| 20260909042926 / gwd06_ingestion_token_gate | 20260909031500_gwd06_ingestion_token_gate.sql | DIFF |
| 20260909044801 / gwd08_grants_rls_views_hardening | 20260909032000_gwd08_grants_rls_views_hardening.sql | DIFF |
| 20260909053844 / task17_prototype_frame_mapping | 20260909053844_task17_prototype_frame_mapping.sql | DIFF |
| 20260909081424 / task29_task_instruction_and_atomic_reorder | 20260909081424_task29_task_instruction_and_atomic_reorder.sql | DIFF |
| 20260909082424 / task30_disjoint_terminal_targets | 20260909082424_task30_disjoint_terminal_targets.sql | DIFF |
| 20260909102718 / task31_post_task_questions | 20260909094000_task31_post_task_questions.sql | DIFF |
| 20260909102745 / task32_publish_versioning | 20260909100000_task32_publish_versioning.sql | DIFF |
| 20260909102758 / task33_anonymous_session_entry | 20260909103000_task33_anonymous_session_entry.sql | DIFF |
| 20260909102833 / task38_41_lifecycle_derivation | 20260909110000_task38_41_lifecycle_derivation.sql | DIFF |
| 20260909102851 / task37_post_task_feedback | 20260909113000_task37_post_task_feedback.sql | DIFF |
| 20260909114606 / task50_findings_evidence_model | 20260909111500_task50_findings_evidence_model.sql | MATCH |
| 20260909125410 / task48_funnel_definition | 20260909123000_task48_funnel_definition.sql | MATCH |
| 20260910163157 / task39_figma_geometry_snapshot | 20260910173000_task39_figma_geometry_snapshot.sql | MATCH |
| 20260921164925 / mt03_provider_neutral_target_snapshot | 20260921155500_mt03_provider_neutral_target_snapshot.sql | DIFF |
| 20260923092440 / auto_major_execution_leases | 20260923092500_auto_major_execution_leases.sql | DIFF |
| 20260923095639 / proof_gate_major_ids | 20260923105000_proof_gate_major_ids.sql | DIFF |
| 20260923103600 / major_a_workspace_bootstrap | 20260923113000_major_a_workspace_bootstrap.sql | MATCH |
| 20260923122406 / mt08_provider_neutral_outcome_rules | 20260923125000_mt08_provider_neutral_outcome_rules.sql | MATCH |
| 20260925135532 / mt10_report_finding_fields | 20260925143000_mt10_report_finding_fields.sql | MATCH |

Next: compare each stored statement with the corresponding repository SQL, build a reviewed canonical replay in an isolated development database, and verify migration/RLS smoke. Supabase branch status remains MIGRATIONS_FAILED. Development branch/billing and researcher session QA are still external prerequisites. FEAT-13 SQL is absent from Production history; do not apply it there to test.

## Reconciliation implementation

Token-level comparison (preserving quoted literals) matches 24 of the 25 named stored entries; the first GWD-08 grant migration differs. The later recorded GWD-08 migration matches the repository hardening SQL. Production also records a private ACL correction missing from GitHub.

Align repository migration filenames with their actual stored versions, retain the matching SQL bodies and comments, and add the two earlier recorded grant/correction steps verbatim. Do not delete or rewrite stored Production migration history. Replay the complete ordered history plus FEAT-13 in a disposable database and inspect final ACL/RLS. Cloud development-branch replay remains required after Pro is ready.

Local evidence: both the 26 stored baseline migrations plus FEAT-13 and the aligned 27 repository files replayed successfully on disposable PostgreSQL 16.15 databases. FEAT-13 migration/RLS smoke passed on both; final pg_dump schema and ACL token streams match. The authenticated role cannot execute private retention/ingestion maintenance functions. Production was only read, with no migration/history updates.

The cloud branch remains MIGRATIONS_FAILED until the aligned history is available to the approved development branch and replayed there. Billing and live branch validation remain BLOCKED_EXTERNAL; do not describe offline replay as cloud readiness.
