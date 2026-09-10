import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Task33 public snapshot lookup does not require session token signing configuration", async () => {
  const snapshotRoute = await readFile(
    new URL("../src/app/api/public/tests/[testVersionId]/route.ts", import.meta.url),
    "utf8",
  );
  const sessionRoute = await readFile(
    new URL("../src/app/api/public/tests/[testVersionId]/session/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(snapshotRoute, /snapshotServerConfig\(\)/);
  assert.doesNotMatch(snapshotRoute, /runnerServerConfig\(\)/);
  assert.match(snapshotRoute, /only reads a published snapshot/);

  // Session creation must retain the fail-closed signing-key requirement.
  assert.match(sessionRoute, /runnerServerConfig\(\)/);
  assert.match(sessionRoute, /mintRunnerSessionProof/);
});
