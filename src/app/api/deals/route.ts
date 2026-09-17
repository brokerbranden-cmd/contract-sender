import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const stage = req.nextUrl.searchParams.get("stage");
  const deals = await prisma.deal.findMany({
    where: stage ? { stage } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      property: true,
      agent: true,
      contracts: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { activities: true } },
    },
  });
  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });

  const deal = await prisma.deal.create({
    data: {
      title: body.title,
      stage: body.stage || "new",
      offerPrice: body.offerPrice != null ? Number(body.offerPrice) : null,
      earnestMoney:
        body.earnestMoney != null
          ? Number(body.earnestMoney)
          : settings?.defaultEarnest ?? 1000,
      closingDays:
        body.closingDays != null
          ? Number(body.closingDays)
          : settings?.defaultClosingDays ?? 30,
      inspectionDays:
        body.inspectionDays != null
          ? Number(body.inspectionDays)
          : settings?.defaultInspectionDays ?? 10,
      financingType: body.financingType || "Cash",
      contingencies: body.contingencies || null,
      notes: body.notes || null,
      propertyId: body.propertyId,
      agentId: body.agentId || null,
    },
    include: { property: true, agent: true },
  });

  await prisma.activity.create({
    data: {
      dealId: deal.id,
      type: "created",
      message: `Deal created: ${deal.title}`,
    },
  });

  return NextResponse.json(deal, { status: 201 });
}
