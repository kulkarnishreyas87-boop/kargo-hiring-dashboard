import { NextResponse } from "next/server";
import { sendDraftedEmail } from "@/lib/sendEmail";

export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await sendDraftedEmail(id);
  if (!result.ok) {
    const status = result.error === "Not found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, resendId: result.resendId });
}
