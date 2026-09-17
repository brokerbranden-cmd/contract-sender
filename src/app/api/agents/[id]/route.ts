import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    include: { deals: { include: { property: true } } },
  });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const agent = await prisma.agent.update({
    where: { id: params.id },
    data: {
      ...(body.name != null && { name: body.name }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.brokerage !== undefined && { brokerage: body.brokerage || null }),
      ...(body.licenseNo !== undefined && { licenseNo: body.licenseNo || null }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  });
  return NextResponse.json(agent);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.agent.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
