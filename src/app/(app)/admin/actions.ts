"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { reingestLaw } from "@/lib/reingest";

/**
 * Approve a proposed law change: replace the law's text, re-index it for RAG,
 * and mark the proposal approved. Admin-only.
 */
export async function approveProposal(id: number): Promise<void> {
  const admin = await requireAdmin();
  const supabase = getSupabaseAdmin();

  const { data: p } = await supabase
    .from("law_proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!p || p.status !== "pending") return;

  const { data: law } = await supabase
    .from("laws")
    .select("slug, title, applied_nn")
    .eq("slug", p.law_slug)
    .maybeSingle();
  if (!law) throw new Error("Zakon nije pronađen.");

  // 1) Replace the authoritative text.
  const appliedNn = Array.from(new Set([...(law.applied_nn ?? []), p.nn_number]));
  const { error: upErr } = await supabase
    .from("laws")
    .update({
      current_text: p.proposed_text,
      version_label: p.nn_number,
      applied_nn: appliedNn,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", p.law_slug);
  if (upErr) throw new Error(`Ažuriranje zakona nije uspjelo: ${upErr.message}`);

  // 2) Re-index this law for RAG.
  await reingestLaw(law.title, p.proposed_text);

  // 3) Mark the proposal approved.
  await supabase
    .from("law_proposals")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: admin.usr })
    .eq("id", id);

  revalidatePath("/admin/promjene");
  revalidatePath(`/zakoni/${p.law_slug}`);
}

/** Reject a proposed change. Admin-only. */
export async function rejectProposal(id: number): Promise<void> {
  const admin = await requireAdmin();
  await getSupabaseAdmin()
    .from("law_proposals")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: admin.usr })
    .eq("id", id);
  revalidatePath("/admin/promjene");
}
