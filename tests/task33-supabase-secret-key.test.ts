import assert from "node:assert/strict";
import test from "node:test";

import { createSupabaseAdminFetch } from "../src/lib/runner/supabase-admin-fetch.ts";

test("Task33 sb_secret key is sent via apikey only, not Authorization Bearer", async () => {
  const seen = new Headers();
  const wrapped = createSupabaseAdminFetch("sb_secret_example", async (_input, init) => {
    const received = new Headers(init?.headers);
    received.forEach((value, key) => seen.set(key, value));
    return Response.json([]);
  });

  await wrapped("https://example.supabase.co/rest/v1/test_versions", {
    headers: {
      apikey: "sb_secret_example",
      authorization: "Bearer sb_secret_example",
    },
  });

  assert.equal(seen.get("apikey"), "sb_secret_example");
  assert.equal(seen.has("authorization"), false);
});

test("Task33 legacy service_role JWT keeps Authorization Bearer compatibility", async () => {
  const seen = new Headers();
  const legacy = "eyJlegacy-service-role";
  const wrapped = createSupabaseAdminFetch(legacy, async (_input, init) => {
    const received = new Headers(init?.headers);
    received.forEach((value, key) => seen.set(key, value));
    return Response.json([]);
  });

  await wrapped("https://example.supabase.co/rest/v1/test_versions", {
    headers: { apikey: legacy, authorization: `Bearer ${legacy}` },
  });

  assert.equal(seen.get("apikey"), legacy);
  assert.equal(seen.get("authorization"), `Bearer ${legacy}`);
});
