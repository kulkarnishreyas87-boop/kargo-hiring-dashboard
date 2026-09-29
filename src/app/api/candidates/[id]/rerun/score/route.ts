import { NextResponse } from "next/server";
import { runScoreStage } from "@/lib/pipeline";

export const maxDuration = 45;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { scoring, guardrail } = await runScoreStage(id);
    return NextResponse.json({ ok: true, tier: guardrail.final_tier, recommendedRole: scoring.recommended_role });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
