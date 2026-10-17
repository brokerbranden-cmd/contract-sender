import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSendCapStatus } from "@/lib/offers";

export const dynamic = "force-dynamic";

/** GET ?status=ready|sent|all (default ready) */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "ready";
  const items = await prisma.outboxItem.findMany({
    where: status === "all" ? { status: { not: "cancelled" } } : { status },
    orderBy: status === "sent" ? { sentAt: "desc" } : { createdAt: "asc" },
    take: 1000,
    include: { deal: { include: { property: true, agent: true } } },
  });
  const cap = await getSendCapStatus(prisma);
  return NextResponse.json({
    cap,
    items: items.map((i) => ({
      id: i.id,
      dealId: i.dealId,
      status: i.status,
      to: i.toEmail,
      subject: i.subject,
      body: i.body,
      pdfPath: i.pdfPath,
      batchId: i.batchId,
      exportedAt: i.exportedAt,
      sentAt: i.sentAt,
      createdAt: i.createdAt,
      address: `${i.deal.property.address}, ${i.deal.property.city}`,
      mlsNumber: i.deal.property.mlsNumber,
      offerPrice: i.deal.offerPrice,
      agentName: i.deal.agent?.name ?? null,
    })),
  });
}
