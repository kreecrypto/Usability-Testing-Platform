import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { demoMetrics, demoSteps, demoStudy } from "../src/lib/demo/public-demo.ts";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("demo has complete, linked public journey with coherent synthetic results", () => {
  assert.deepEqual(demoSteps.map(({ slug }) => slug), ["projects", "test", "results", "findings", "report", "retest"]);
  assert.equal(demoStudy.sessions.length, 6);
  assert.equal(demoMetrics.baselineEligible, 5);
  assert.equal(demoMetrics.baselineSuccess, 3);
  assert.equal(demoMetrics.baselineTechnical, 1);
  assert.equal(demoStudy.retest.success, 4);
  assert.equal(demoStudy.retest.eligible, 5);
});

test("demo cannot fetch production data or offer writes and anonymous guest entry is closed", () => {
  const demo = read("src/app/demo/[step]/page.tsx") + read("src/app/demo/page.tsx") + read("src/lib/demo/public-demo.ts");
  assert.doesNotMatch(demo, /fetch\s*\(|\/api\/|SUPABASE_|service.role|<form|method=["'](?:POST|PUT|PATCH|DELETE)/i);
  assert.match(demo, /ข้อมูลตัวอย่าง/);
  assert.equal(existsSync(new URL("../src/app/api/auth/guest/route.ts", import.meta.url)), false);
});
