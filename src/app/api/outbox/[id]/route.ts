import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** PATCH { to?, subject?, body? } — edit a ready item. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json();
  const item = await prisma.outboxItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "ready") {
    return NextResponse.json({ error: "Only ready items can be edited" }, { status: 400 });
  }
  const updated = await prisma.outboxItem.update({
    where: { id: item.id },
    data: {
      ...(typeof b.to === "string" && { toEmail: b.to.trim() }),
      ...(typeof b.subject === "string" && { subject: b.subject }),
      ...(typeof b.body === "string" && { body: b.body }),
    },
  });
  return NextResponse.json(updated);
}
