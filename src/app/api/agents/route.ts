import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const agents = await prisma.agent.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { deals: true } } },
  });
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const agent = await prisma.agent.create({
    data: {
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      brokerage: body.brokerage || null,
      licenseNo: body.licenseNo || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(agent, { status: 201 });
}
