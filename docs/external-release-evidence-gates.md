# External Release Evidence Gates

These gates must not be converted into code-only COMPLETE claims.

1. Task 22 / Task 33 — run a real production published-test → anonymous-session → ingestion-token → collector persistence/dedupe E2E using source-backed data.
2. GWD-02 / GWD-10 — configure the real Figma Embed API client ID and allowed production origin, then capture live public/restricted access states and live event evidence.
3. Task 53 — provide source-authorized seed prototype artifacts/specifications for Mobile Checkout, Desktop CRM Case Creation, and Mobile Banking, including expected path/target mapping.
4. Task 56 — execute the supported browser/device matrix on the active runtime and record Critical=0 evidence.
5. Task 59 — execute human UX Designer end-to-end UAT and record Critical UX Issue=0 evidence.

Everything else should be reduced to deterministic code/config/docs/tests where possible before these gates are run.
