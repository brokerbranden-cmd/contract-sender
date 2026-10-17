import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markBatchSent } from "@/lib/outbox";

export const dynamic = "force-dynamic";

/**
 * POST outbox-batch.json (or { dealIds: [...] }) — marks those deals' outbox items sent.
 * Items with "status": "failed" (or "sent": false) are left untouched.
 */
export async function POST(req: NextRequest) {
  const input = await req.json().catch(() => null);
  if (!input) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const result = await markBatchSent(prisma, input);
  return NextResponse.json(result);
}
