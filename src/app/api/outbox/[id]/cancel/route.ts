import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Remove a ready item from the Outbox (the deal stays offer_drafted). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const item = await prisma.outboxItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "ready") {
    return NextResponse.json({ error: "Only ready items can be removed" }, { status: 400 });
  }
  await prisma.outboxItem.update({ where: { id: item.id }, data: { status: "cancelled" } });
  return NextResponse.json({ ok: true });
}
