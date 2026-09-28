import { NextResponse } from "next/server";
import { all, one } from "@/lib/db";

export async function GET() {
  const totals = await one<{ n: string }>(`SELECT COUNT(*) as n FROM candidates WHERE source = 'applicant'`);
  const byStatus = await all(`SELECT pipeline_status, COUNT(*) as n FROM candidates WHERE source='applicant' GROUP BY pipeline_status`);
  const byTier = await all(`SELECT final_tier, COUNT(*) as n FROM scores GROUP BY final_tier`);
  const potential = await one<{ n: string }>(`SELECT COUNT(*) as n FROM scores WHERE potential_flag = 1`);
  const decisions = await all(`SELECT decision, COUNT(*) as n FROM decisions GROUP BY decision`);
  const emailsSent = await one<{ n: string }>(`SELECT COUNT(*) as n FROM emails WHERE status = 'sent'`);
  const emailsDrafted = await one<{ n: string }>(`SELECT COUNT(*) as n FROM emails WHERE status = 'drafted'`);

  return NextResponse.json({
    total: Number(totals?.n ?? 0),
    byStatus,
    byTier,
    potentialFlagged: Number(potential?.n ?? 0),
    decisions,
    emailsSent: Number(emailsSent?.n ?? 0),
    emailsDrafted: Number(emailsDrafted?.n ?? 0),
  });
}
