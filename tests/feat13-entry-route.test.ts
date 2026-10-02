import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { POST } from "../src/app/api/public/methods/[testVersionId]/start/route.ts";

const versionId = "55555555-5555-4555-8555-555555555555";
const testId = "44444444-4444-4444-8444-444444444444";
const participantId = "99999999-9999-4999-8999-999999999999";
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const token = "a".repeat(43);

test("method start hashes the one-use token and mints a cookie only for eligible participants", async () => {
  const originalFetch = globalThis.fetch;
  const old = { url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY, signing: process.env.EVENT_INGESTION_TOKEN_SECRET };
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "server-secret";
  process.env.EVENT_INGESTION_TOKEN_SECRET = "test-signing-key";
  let rpcBody: unknown = null;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/test_versions")) return Response.json([{ id: versionId, test_id: testId, workspace_id: "22222222-2222-4222-8222-222222222222", version_no: 1, lifecycle_status: "published", study_mode: "methods", screener_config: { questions: [] }, invite_only: true }]);
    if (path.endsWith("/tests")) return Response.json([{ id: testId, title: "Study", description: null, status: "published" }]);
    if (path.endsWith("/study_blocks")) return Response.json([{ id: "66666666-6666-4666-8666-666666666666", ordinal: 1, kind: "survey", title: "Question", config: { questions: [{ id: "q1", prompt: "Hello?", type: "text", required: true }] } }]);
    if (path.endsWith("/rpc/start_method_participant_session")) {
      rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json([{ eligible: true, participant_id: participantId, session_id: sessionId, test_id: testId, test_version_id: versionId }]);
    }
    throw new Error(`unexpected ${path}`);
  };
  try {
    const response = await POST(new Request(`https://utp.example.com/api/public/methods/${versionId}/start`, {
      method: "POST", body: JSON.stringify({ accepted: true, inviteToken: token, answers: {}, locale: "th" }),
    }), { params: Promise.resolve({ testVersionId: versionId }) });
    assert.equal(response.status, 201);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Lax; Secure/);
    assert.equal((rpcBody as Record<string, unknown> | null)?.p_token_hash, createHash("sha256").update(token).digest("hex"));
    assert.ok(!JSON.stringify(rpcBody).includes(token));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [["SUPABASE_URL", old.url], ["SUPABASE_SECRET_KEY", old.secret], ["EVENT_INGESTION_TOKEN_SECRET", old.signing]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("method start rejects missing invite before creating a session", async () => {
  const response = await POST(new Request(`https://utp.example.com/api/public/methods/${versionId}/start`, {
    method: "POST", body: JSON.stringify({ accepted: true, inviteToken: "invalid!", answers: {} }),
  }), { params: Promise.resolve({ testVersionId: versionId }) });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("set-cookie"), null);
});
