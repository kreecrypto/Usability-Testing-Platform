# MT-09 authoritative Results target context — 2026-09-26

Status: QA; MT-09 remains IN_PROGRESS.

Source: current Google Sheet Task List row 102 and exact main implementation aa3d7fc. This change addresses the requirement for Results/Report claims to carry immutable test version and target snapshot/capability provenance.

ResultsStore now queries target provider and snapshot from the exact persisted test_versions row, validates the version identifier, and returns not_found when there is no row. ResultsModel carries the parsed context and limits events to its persisted test ID. Report uses the same parser and rejects a context different from Results. Conflicting provider fields fail closed with no authoritative provider, snapshot version, or capabilities.

QA: npm ci, npm run qa passed (build, typecheck, 271/271 tests). Targeted tests cover persisted cross-provider context, missing version, malformed UUID, conflicting provider, and Report mismatch. No lint script exists.

Results now builds capability-aware Metric Observations once; Report reuses the same observations. Remaining MT-09 gates: verify cross-provider path/coordinate behavior and live browser evidence. No synthetic Production participant evidence was created.
