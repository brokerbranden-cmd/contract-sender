import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const templates = await prisma.contractTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.isDefault) {
    await prisma.contractTemplate.updateMany({ data: { isDefault: false } });
  }
  const template = await prisma.contractTemplate.create({
    data: {
      name: body.name,
      description: body.description || null,
      body: body.body,
      isDefault: !!body.isDefault,
    },
  });
  return NextResponse.json(template, { status: 201 });
}
