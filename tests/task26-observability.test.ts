import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const healthPath = new URL("../src/app/api/health/route.ts", import.meta.url);
const loggerPath = new URL("../src/lib/observability/structured-log.ts", import.meta.url);
const docsPath = new URL("../docs/task26-observability.md", import.meta.url);

test("health check is bounded, non-cacheable and fails closed", async () => {
  const source = await readFile(healthPath, "utf8");
  assert.match(source, /AbortSignal\.timeout\(3000\)/);
  assert.match(source, /status: healthy \? 200 : 503/);
  assert.match(source, /cache-control.*no-store/i);
  assert.match(source, /storage\/v1\/bucket/);
  assert.match(source, /dependencies: \{ supabaseDatabase, supabaseStorage \}/);
  assert.match(source, /supabaseDatabase === "ok" && supabaseStorage === "ok"/);
  assert.doesNotMatch(source, /secretKey[^\n]*Response\.json/);
});

test("structured logging provides correlation without payload or secret fields", async () => {
  const source = await readFile(loggerPath, "utf8");
  for (const field of ["requestId", "sessionId", "testVersionId", "eventId", "operation"]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /omit stack traces, request bodies, tokens and provider\/database secrets/i);
  assert.doesNotMatch(source, /authorization:/i);
  assert.doesNotMatch(source, /apikey:/i);
});

test("Supabase Storage readiness does not invent a bucket contract", async () => {
  const docs = await readFile(docsPath, "utf8");
  assert.match(docs, /Supabase Storage/);
  assert.match(docs, /empty bucket list is valid readiness/i);
  assert.match(docs, /No Storage bucket is provisioned until a V1 task introduces a real file\/blob artifact requirement/i);
  assert.doesNotMatch(docs, /Cloudflare R2/i);
});
