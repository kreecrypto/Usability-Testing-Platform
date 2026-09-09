import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createPublicRunnerStore,
  INGESTION_TOKEN_TTL_SECONDS,
  PublicRunnerError,
} from "../src/lib/runner/public-session.ts";

const VERSION_ID = "20000000-0000-4000-8000-000000000002";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Task 57 consent gate rejects before any participant session request or tracking credential exists", async () => {
  let calls = 0;
  const store = createPublicRunnerStore({
    supabaseUrl: "https://example.supabase.co",
    secretKey: "server-only-secret",
    signingKey: "server-only-signing-key",
    fetchImpl: async () => {
      calls += 1;
      throw new Error("fetch must not run without consent");
    },
  });

  await assert.rejects(
    store.startSession(VERSION_ID, ""),
    (error: unknown) => error instanceof PublicRunnerError && error.code === "invalid_consent",
  );
  assert.equal(calls, 0);
  assert.equal(INGESTION_TOKEN_TTL_SECONDS, 300);
});

test("Task 57 public session route requires accepted consent and issues HttpOnly SameSite proof", async () => {
  const route = await source("src/app/api/public/tests/[testVersionId]/session/route.ts");
  assert.match(route, /accepted !== true/);
  assert.match(route, /!consentVersion\.trim\(\)/);
  assert.match(route, /consent_required/);
  assert.match(route, /HttpOnly/);
  assert.match(route, /SameSite=Lax/);
  assert.match(route, /; Secure/);
});

test("Task 57 participant client receives only session-bound credentials and no server secret names", async () => {
  const client = await source("src/app/t/[testVersionId]/participant-runner-client.tsx");
  assert.match(client, /ingestionToken/);
  assert.match(client, /ingestionTokenExpiresAt/);
  assert.match(client, /\/api\/public\/sessions\/token/);
  assert.doesNotMatch(client, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|EVENT_INGESTION_TOKEN_SECRET/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_SUPABASE_SECRET_KEY|NEXT_PUBLIC_EVENT_INGESTION_TOKEN_SECRET/);
});

test("Task 57 retention and delete propagation remove reconstructable evidence before session deletion", async () => {
  const retention = await source("supabase/migrations/20260909033000_task24_retention_archiving.sql");
  assert.match(retention, /completed_at \+ interval '90 days'/i);
  const evidenceDelete = retention.indexOf("delete from public.finding_evidence");
  const sessionDelete = retention.indexOf("delete from public.sessions");
  assert.ok(evidenceDelete >= 0);
  assert.ok(sessionDelete > evidenceDelete);
  assert.match(retention, /grant execute on function private\.purge_expired_sessions[\s\S]*to service_role/i);
  assert.match(retention, /revoke all on function private\.purge_expired_sessions[\s\S]*from public, anon, authenticated/i);
});

test("Task 57 grants RLS and tenant-scoped finding evidence fail closed", async () => {
  const hardening = await source("supabase/migrations/20260909032000_gwd08_grants_rls_views_hardening.sql");
  const findings = await source("supabase/migrations/20260909111500_task50_findings_evidence_model.sql");
  assert.match(hardening, /revoke all on all tables in schema public from anon/i);
  assert.match(hardening, /revoke execute on all functions in schema public from anon/i);
  assert.match(hardening, /force row level security/i);
  for (const constraint of [
    "finding_evidence_workspace_finding_scope_fk",
    "finding_evidence_workspace_session_scope_fk",
    "finding_evidence_workspace_event_scope_fk",
    "finding_evidence_workspace_answer_scope_fk",
  ]) assert.match(findings, new RegExp(constraint, "i"));
});

test("Task 57 server runner config keeps elevated keys server-only", async () => {
  const server = await source("src/lib/runner/public-session.ts");
  assert.match(server, /process\.env\.SUPABASE_SECRET_KEY/);
  assert.match(server, /process\.env\.EVENT_INGESTION_TOKEN_SECRET/);
  assert.doesNotMatch(server, /NEXT_PUBLIC_SUPABASE_SECRET_KEY|NEXT_PUBLIC_EVENT_INGESTION_TOKEN_SECRET/);
  assert.match(server, /sessionId, testVersionId/);
  assert.match(server, /row\.status !== "active"/);
});