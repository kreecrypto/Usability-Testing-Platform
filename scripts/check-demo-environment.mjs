const productionSupabaseProjectRef = "qryvrcwbsehrzpersuoc";
const productionAppOrigin = "https://usability-testing-platform.vercel.app";

const candidates = [
  ["SUPABASE_URL", process.env.SUPABASE_URL],
  ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
  ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL],
];

const violations = candidates
  .filter(([, value]) => typeof value === "string" && value.length > 0)
  .filter(([name, value]) => {
    if (name === "NEXT_PUBLIC_APP_URL") {
      return value.replace(/\/$/, "") === productionAppOrigin;
    }
    return value.includes(productionSupabaseProjectRef);
  });

if (violations.length > 0) {
  console.error("DEMO_QA_BLOCKED: demo QA must not target UTP production resources.");
  for (const [name] of violations) console.error(`- ${name} points to production`);
  process.exit(1);
}

console.log("DEMO_ENV_SAFE: no UTP production runtime or Supabase project detected.");
