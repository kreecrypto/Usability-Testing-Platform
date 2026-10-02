import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

// Applied baseline migrations are immutable. New migrations must use new versions.
const manifest = JSON.parse(readFileSync(new URL("../supabase/migration-history.json", import.meta.url), "utf8"));
const files = readdirSync(new URL("../supabase/migrations/", import.meta.url));
const versions = files.map((file) => file.split("_")[0]);
if (new Set(versions).size !== versions.length) throw new Error("duplicate_migration_version");
if (manifest.entries.length !== manifest.baselineCount) throw new Error("baseline_count_mismatch");
for (const entry of manifest.entries) {
  const expected = `${entry.version}_${entry.name}.sql`;
  if (!files.includes(expected) || entry.path !== `supabase/migrations/${expected}`) throw new Error(`baseline_missing:${expected}`);
  const actual = createHash("sha256").update(readFileSync(new URL(`../${entry.path}`, import.meta.url))).digest("hex");
  if (actual !== entry.repositorySha256) throw new Error(`applied_baseline_changed:${expected}`);
}
console.log(`PASS ${manifest.baselineCount} reconciled migration versions and immutable SQL baselines`);
