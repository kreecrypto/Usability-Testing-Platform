import assert from "node:assert/strict";
import test from "node:test";

import { createPublicRunnerStore, PublicRunnerError } from "../src/lib/runner/public-session.ts";

const VERSION_ID = "20000000-0000-4000-8000-000000000099";

function createStore(fetchImpl: typeof fetch) {
  return createPublicRunnerStore({
    supabaseUrl: "https://example.supabase.co",
    secretKey: "server-secret",
    signingKey: "signing-secret",
    fetchImpl,
  });
}

test("Task33 missing published version maps an empty Supabase result to published_test_not_found 404", async () => {
  const store = createStore(async () => Response.json([]));

  await assert.rejects(
    () => store.snapshot(VERSION_ID),
    (error: unknown) => {
      assert.ok(error instanceof PublicRunnerError);
      assert.equal(error.code, "published_test_not_found");
      assert.equal(error.status, 404);
      return true;
    },
  );
});

test("Task33 provider failure remains data_request_failed 502 instead of being misreported as not-found", async () => {
  const store = createStore(async () => Response.json({ message: "provider failure" }, { status: 401 }));

  await assert.rejects(
    () => store.snapshot(VERSION_ID),
    (error: unknown) => {
      assert.ok(error instanceof PublicRunnerError);
      assert.equal(error.code, "data_request_failed");
      assert.equal(error.status, 502);
      return true;
    },
  );
});
