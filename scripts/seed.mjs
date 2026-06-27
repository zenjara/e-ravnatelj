// scripts/seed.mjs
// Seed two test principals into the `users` table with bcrypt-hashed passwords.
//
// Run:  npm run seed
//   (which is: node --env-file=.env.local scripts/seed.mjs)
//
// Idempotent: upserts on `username`, so re-running just refreshes the rows.
// Requires the 0001_users.sql migration to have been applied first.

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// --- Test credentials (DEV ONLY) -------------------------------------------
// Plaintext passwords live only here, for local login during development.
// They are bcrypt-hashed before insert; only the hash is stored.
const PRINCIPALS = [
  {
    username: "ravnatelj1",
    password: "lozinka123",
    school_name: "OŠ Ivana Gundulića, Zagreb",
    role: "principal",
  },
  {
    username: "ravnatelj2",
    password: "lozinka456",
    school_name: "OŠ Petra Preradovića, Đakovo",
    role: "principal",
  },
  {
    username: "admin",
    password: "admin123",
    school_name: "Administrator",
    role: "admin",
  },
];

function getEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(
      `\n✗ Missing ${name}. Did you run via "npm run seed" (loads .env.local)?\n`,
    );
    process.exit(1);
  }
  return v;
}

async function main() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = await Promise.all(
    PRINCIPALS.map(async (p) => ({
      username: p.username,
      password_hash: await bcrypt.hash(p.password, SALT_ROUNDS),
      school_name: p.school_name,
      role: p.role,
    })),
  );

  const { data, error } = await supabase
    .from("users")
    .upsert(rows, { onConflict: "username" })
    .select("id, username, school_name");

  if (error) {
    console.error("\n✗ Seed failed:", error.message);
    if (/relation .*users.* does not exist|schema cache/i.test(error.message)) {
      console.error(
        "  → The `users` table isn't there yet. Run supabase/migrations/0001_users.sql\n" +
          "    in the Supabase SQL editor first, then re-run `npm run seed`.",
      );
    }
    process.exit(1);
  }

  console.log("\n✓ Seeded principals:");
  for (const r of data) console.log(`  • ${r.username} — ${r.school_name}`);
  console.log("\nDEV login credentials:");
  for (const p of PRINCIPALS) console.log(`  • ${p.username} / ${p.password}`);
  console.log("");
}

main().catch((e) => {
  console.error("\n✗ Unexpected error:", e);
  process.exit(1);
});
