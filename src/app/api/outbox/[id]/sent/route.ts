import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markOutboxSent } from "@/lib/outbox";

export const dynamic = "force-dynamic";

/** POST { force? } — mark one outbox item sent (enforces the daily cap unless force). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => ({}));
  const r = await markOutboxSent(prisma, params.id, {
    force: !!b.force,
    enforceCap: true,
    via: "manual",
  });
  if (!r.ok) {
    const status = r.reason === "not_found" ? 404 : r.reason === "cap_reached" ? 429 : 409;
    return NextResponse.json({ error: r.message, reason: r.reason }, { status });
  }
  return NextResponse.json(r);
}
