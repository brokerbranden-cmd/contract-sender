import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = await prisma.contractTemplate.findUnique({
    where: { id: params.id },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  if (body.isDefault) {
    await prisma.contractTemplate.updateMany({ data: { isDefault: false } });
  }
  const template = await prisma.contractTemplate.update({
    where: { id: params.id },
    data: {
      ...(body.name != null && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.body != null && { body: body.body }),
      ...(body.isDefault !== undefined && { isDefault: !!body.isDefault }),
    },
  });
  return NextResponse.json(template);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.contractTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
