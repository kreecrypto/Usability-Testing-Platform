import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/public/methods/[testVersionId]/responses/route.ts";
import { mintRunnerSessionProof } from "../src/lib/runner/session-proof.ts";
import { prepareTreeSubmission, scaleAnswer } from "../src/lib/methods/runner-recovery.ts";
import { createMethodRunnerStore } from "../src/lib/methods/runner-store.ts";
import { parseSurveyConfig, parseMethodResponse } from "../src/lib/methods/study-contract.ts";
const versionId = "55555555-5555-4555-8555-555555555555";
const testId = "44444444-4444-4444-8444-444444444444";
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const blockId = "66666666-6666-4666-8666-666666666666";
const answer = (durationMs: number) => ({ promptId: "p", path: ["root", "leaf"], trace: ["root", "leaf"], selectedNodeId: "leaf", durationMs });
function fixture(failure: "completion" | "lost_response" | "none" = "none") {
  let responseBlockId = blockId;
  let saved: unknown = null, status = "active", inserts = 0, patches = 0, fail = true;
  const fetchImpl: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/test_versions")) return Response.json([{ id: versionId, test_id: testId, workspace_id: testId, version_no: 1, lifecycle_status: "published", study_mode: "methods", screener_config: { questions: [] }, invite_only: false }]);
    if (path.endsWith("/tests")) return Response.json([{ id: testId, title: "Tree", status: "published" }]);
    if (path.endsWith("/study_blocks")) return Response.json([{ id: blockId, ordinal: 1, kind: "tree_test", config: { nodes: [{ id: "root", label: "Root", parentId: null }, { id: "leaf", label: "Leaf", parentId: "root" }], prompts: [{ id: "p", title: "Find", correctNodeId: "leaf" }] } }]);
    if (path.endsWith("/sessions")) {
      if (init?.method === "PATCH") { patches++; if (failure === "completion" && fail) { fail = false; return Response.json({}, { status: 503 }); } status = "completed"; return Response.json([]); }
      return Response.json([{ id: sessionId, workspace_id: testId, test_version_id: versionId, status }]);
    }
    if (path.endsWith("/study_responses")) {
      if (init?.method === "POST") { inserts++; saved = JSON.parse(String(init.body)).response; if (failure === "lost_response" && fail) { fail = false; throw new Error("network lost after insert"); } return Response.json([{ id: sessionId }]); }
      return Response.json(saved ? [{ id: sessionId, block_id: responseBlockId, response: saved }] : []);
    }
    throw new Error(path);
  };
  return { fetchImpl, store: createMethodRunnerStore({ supabaseUrl: "https://example.supabase.co", secretKey: "mock-only", fetchImpl }), counts: () => ({ inserts, patches, status }), corrupt: (response: unknown, id = blockId) => { saved = response; responseBlockId = id; } };
}
for (const failure of ["completion", "lost_response"] as const) test(`Tree retry preserves elapsed time after ${failure}`, async () => {
  const f = fixture(failure);
  const pending = prepareTreeSubmission(null, [], answer(1000));
  await assert.rejects(f.store.submit(versionId, sessionId, blockId, pending));
  const retry = prepareTreeSubmission(pending, [], answer(2000));
  assert.strictEqual(retry, pending);
  assert.equal(retry.attempts[0].durationMs, 1000);
  assert.equal((await f.store.submit(versionId, sessionId, blockId, retry)).completed, true);
  assert.equal(f.counts().inserts, 1);
  await assert.rejects(f.store.submit(versionId, sessionId, blockId, { attempts: [answer(2000)] }), /already_submitted/);
});
test("reload GET remains read-only; explicit completion recovery repairs saved final response", async () => {
  const f = fixture("completion");
  await assert.rejects(f.store.submit(versionId, sessionId, blockId, { attempts: [answer(1000)] }));
  assert.deepEqual(await f.store.progress(versionId, sessionId), { status: "active", completedBlockIds: [blockId] });
  assert.equal(f.counts().patches, 1);
  assert.deepEqual(await f.store.recoverCompletion(versionId, sessionId), { completed: true });
  assert.equal(f.counts().status, "completed");
  assert.equal(f.counts().inserts, 1);
  await f.store.recoverCompletion(versionId, sessionId);
  assert.equal(f.counts().patches, 2);
});
test("completion recovery cannot finish an unanswered study", async () => {
  const f = fixture();
  await assert.rejects(f.store.recoverCompletion(versionId, sessionId), /responses_incomplete/);
  assert.equal(f.counts().patches, 0);
});
for (const min of [0, 1]) for (const required of [false, true]) test(`scale clearing preserves missing answer: min=${min}, required=${required}`, () => {
  const config = parseSurveyConfig({ questions: [{ id: "q", prompt: "Score", type: "scale", required, min, max: 7 }] });
  assert.equal(scaleAnswer("3"), 3);
  assert.equal(scaleAnswer(""), undefined);
  const response = { answers: {} };
  if (required) assert.throws(() => parseMethodResponse("survey", config, response), /required_answer_missing/);
  else assert.deepEqual(parseMethodResponse("survey", config, response), response);
  if (min === 0) assert.deepEqual(parseMethodResponse("survey", config, { answers: { q: scaleAnswer("0") } }), { answers: { q: 0 } });
});

test("completion recovery rejects invalid and foreign saved evidence", async () => {
  const f = fixture();
  f.corrupt({ attempts: [] });
  await assert.rejects(f.store.recoverCompletion(versionId, sessionId), /saved_response_unavailable/);
  f.corrupt({ attempts: [answer(1000)] }, testId);
  await assert.rejects(f.store.recoverCompletion(versionId, sessionId), /responses_incomplete/);
  assert.equal(f.counts().patches, 0);
});

test("explicit recovery retains session proof gate and rejects unknown actions", async () => {
  const keys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "EVENT_INGESTION_TOKEN_SECRET"] as const;
  const previous = keys.map((key) => process.env[key]);
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "mock-only";
  process.env.EVENT_INGESTION_TOKEN_SECRET = "mock-signing";
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("should not request data"); };
  const proof = mintRunnerSessionProof({ signingKey: "mock-signing", sessionId, participantId: testId, testId, testVersionId: versionId, expiresAt: new Date(Date.now() + 60000) });
  const invoke = (body: unknown, cookie = "", id = versionId) => POST(new Request(`https://utp.example.com/api/public/methods/${id}/responses`, { method: "POST", headers: { cookie }, body: JSON.stringify(body) }), { params: Promise.resolve({ testVersionId: id }) });
  try {
    assert.equal((await invoke({ action: "recover_completion" })).status, 401);
    assert.equal((await invoke({ action: "recover_completion" }, `utp_runner_session=${proof}`, testId)).status, 401);
    assert.equal((await invoke({ action: "unknown" }, `utp_runner_session=${proof}`)).status, 400);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});

test("responses POST rejects forged origin and cross-site recovery before database access", async () => {
  const keys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "EVENT_INGESTION_TOKEN_SECRET"] as const;
  const previous = keys.map((key) => process.env[key]);
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "mock-only";
  process.env.EVENT_INGESTION_TOKEN_SECRET = "mock-signing";
  const f = fixture("completion");
  await assert.rejects(f.store.submit(versionId, sessionId, blockId, { attempts: [answer(1000)] }));
  let requests = 0;
  globalThis.fetch = async (input, init) => { requests++; return f.fetchImpl(input, init); };
  const proof = mintRunnerSessionProof({ signingKey: "mock-signing", sessionId, participantId: testId, testId, testVersionId: versionId, expiresAt: new Date(Date.now() + 60000) });
  const invoke = (headers: Record<string, string>, body: unknown = { action: "recover_completion" }) => POST(new Request(`https://utp.example.com/api/public/methods/${versionId}/responses`, { method: "POST", headers: { cookie: `utp_runner_session=${proof}`, "content-type": "text/plain", ...headers }, body: JSON.stringify(body) }), { params: Promise.resolve({ testVersionId: versionId }) });
  try {
    for (const body of [{ action: "recover_completion" }, { blockId, response: { attempts: [answer(1000)] } }]) {
      const response = await invoke({ origin: "https://untrusted.example.com", "sec-fetch-site": "same-site" }, body);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "invalid_origin" });
    }
    assert.equal((await invoke({ origin: "https://utp.example.com", "sec-fetch-site": "cross-site" })).status, 403);
    assert.equal(requests, 0);
    assert.equal(f.counts().patches, 1);
    assert.equal((await invoke({ origin: "https://utp.example.com", "sec-fetch-site": "same-origin" })).status, 200);
    assert.equal(f.counts().status, "completed");
    assert.equal((await invoke({ "sec-fetch-site": "same-origin" })).status, 200);
    assert.equal(f.counts().patches, 2);
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
