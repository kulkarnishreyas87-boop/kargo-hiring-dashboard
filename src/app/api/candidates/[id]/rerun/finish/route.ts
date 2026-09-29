import { NextResponse } from "next/server";
import { runFinishStage } from "@/lib/pipeline";

export const maxDuration = 45;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await runFinishStage(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
