import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      property: true,
      agent: true,
      contracts: {
        orderBy: { createdAt: "desc" },
        include: { template: true },
      },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const existing = await prisma.deal.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deal = await prisma.deal.update({
    where: { id: params.id },
    data: {
      ...(body.title != null && { title: body.title }),
      ...(body.stage != null && { stage: body.stage }),
      ...(body.offerPrice !== undefined && {
        offerPrice: body.offerPrice != null ? Number(body.offerPrice) : null,
      }),
      ...(body.earnestMoney !== undefined && {
        earnestMoney:
          body.earnestMoney != null ? Number(body.earnestMoney) : null,
      }),
      ...(body.closingDays !== undefined && {
        closingDays: body.closingDays != null ? Number(body.closingDays) : null,
      }),
      ...(body.inspectionDays !== undefined && {
        inspectionDays:
          body.inspectionDays != null ? Number(body.inspectionDays) : null,
      }),
      ...(body.financingType != null && { financingType: body.financingType }),
      ...(body.contingencies !== undefined && {
        contingencies: body.contingencies,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.propertyId != null && { propertyId: body.propertyId }),
      ...(body.agentId !== undefined && { agentId: body.agentId || null }),
    },
    include: { property: true, agent: true },
  });

  if (body.stage && body.stage !== existing.stage) {
    await prisma.activity.create({
      data: {
        dealId: deal.id,
        type: "stage_change",
        message: `Stage moved from ${existing.stage} to ${body.stage}`,
      },
    });
  }

  return NextResponse.json(deal);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.deal.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
