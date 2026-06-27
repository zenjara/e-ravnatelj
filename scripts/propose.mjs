// scripts/propose.mjs
// Generate a consolidation PROPOSAL for one law + one amendment, and store it in
// law_proposals (status=pending) for admin review. Article-level so each LLM
// call (and its output) stays small.
//
// Run: node --env-file=.env.local scripts/propose.mjs <law-slug> <nn-number> <amendment-text-file>
// e.g. node --env-file=.env.local scripts/propose.mjs zoio-u-oiss-2018-procisceni-tekst 151/22 /tmp/.../amend-151-22.txt

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_CONSOLIDATE_MODEL ?? "gemini-flash-lite-latest";

function env(n) {
  const v = process.env[n];
  if (!v) { console.error(`Missing ${n}`); process.exit(1); }
  return v;
}

/** Extract the exact text block of "Članak N" up to the next article header. */
function articleBlock(text, n) {
  const lines = text.split("\n");
  const startRe = new RegExp(`^\\s*Članak\\s+${n}\\.`, "i");
  const anyRe = /^\s*Članak\s+\d+[a-z]?\./i;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (anyRe.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join("\n").trim();
}

async function main() {
  const [slug, nn, amendFile] = process.argv.slice(2);
  if (!slug || !nn || !amendFile) {
    console.error("Usage: propose.mjs <law-slug> <nn-number> <amendment-file>");
    process.exit(1);
  }

  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });

  const { data: law, error } = await supabase.from("laws").select("slug, title, current_text").eq("slug", slug).maybeSingle();
  if (error || !law) { console.error("Law not found:", slug, error?.message); process.exit(1); }
  const amendment = await readFile(amendFile, "utf8");

  // 1) Which articles change + a summary.
  console.log("Analiziram izmjenu…");
  const plan = await ai.models.generateContentStream({
    model: MODEL,
    contents:
      "Iz sljedećeg teksta izmjene zakona izvuci kratak sažetak promjena na hrvatskom i popis BROJEVA članaka TEMELJNOG zakona koji se mijenjaju (samo brojevi, npr. \"143\"). " +
      "Vrati isključivo JSON: {\"summary\": string, \"title\": string, \"articles\": string[]}.\n\nTEKST IZMJENE:\n" + amendment,
    config: { responseMimeType: "application/json" },
  });
  let planText = "";
  for await (const c of plan) if (c.text) planText += c.text;
  const { summary, title, articles } = JSON.parse(planText);
  console.log("Sažetak:", summary);
  console.log("Članci:", articles.join(", "));

  // 2) Per article: produce the new text, build diff + proposed full text.
  let proposed = law.current_text;
  const diffParts = [];
  for (const a of articles) {
    const before = articleBlock(law.current_text, a);
    if (!before) { console.warn(`  ⚠ članak ${a} nije pronađen u tekstu — preskačem`); continue; }
    const res = await ai.models.generateContentStream({
      model: MODEL,
      contents:
        `Ti si pravni urednik. Primijeni dolje navedenu izmjenu na TRENUTNI članak ${a} i vrati ISKLJUČIVO novi puni tekst tog članka (uključi zaglavlje "Članak ${a}."), na hrvatskom, bez objašnjenja i bez markdowna.\n\n` +
        `TRENUTNI ČLANAK ${a}:\n${before}\n\nTEKST IZMJENE (uzmi samo dio koji se odnosi na članak ${a}):\n${amendment}`,
      config: {},
    });
    let after = "";
    for await (const c of res) if (c.text) after += c.text;
    after = after.trim();
    proposed = proposed.replace(before, after);
    diffParts.push(`══════ Članak ${a} ══════\n— PRIJE —\n${before}\n\n— POSLIJE —\n${after}`);
    console.log(`  ✓ članak ${a} konsolidiran`);
  }

  const diff = diffParts.join("\n\n");

  // 3) Store the proposal.
  const { error: insErr } = await supabase.from("law_proposals").insert({
    law_slug: slug,
    nn_number: nn,
    amendment_title: title ?? `Izmjena NN ${nn}`,
    summary,
    diff,
    proposed_text: proposed,
    status: "pending",
  });
  if (insErr) { console.error("✗ insert proposal failed:", insErr.message); process.exit(1); }

  console.log(`\n✓ Prijedlog spremljen (pending) za ${slug} ← NN ${nn}. Pregledaj u /admin/promjene.`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
