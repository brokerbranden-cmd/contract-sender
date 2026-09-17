import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: { deals: { include: { agent: true } } },
  });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(property);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const property = await prisma.property.update({
    where: { id: params.id },
    data: {
      ...(body.address != null && { address: body.address }),
      ...(body.city != null && { city: body.city }),
      ...(body.state != null && { state: body.state }),
      ...(body.zip != null && { zip: body.zip }),
      ...(body.mlsNumber !== undefined && { mlsNumber: body.mlsNumber || null }),
      ...(body.listPrice !== undefined && {
        listPrice: body.listPrice != null ? Number(body.listPrice) : null,
      }),
      ...(body.beds !== undefined && {
        beds: body.beds != null ? Number(body.beds) : null,
      }),
      ...(body.baths !== undefined && {
        baths: body.baths != null ? Number(body.baths) : null,
      }),
      ...(body.sqft !== undefined && {
        sqft: body.sqft != null ? Number(body.sqft) : null,
      }),
      ...(body.yearBuilt !== undefined && {
        yearBuilt: body.yearBuilt != null ? Number(body.yearBuilt) : null,
      }),
      ...(body.propertyType != null && { propertyType: body.propertyType }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  });
  return NextResponse.json(property);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.property.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
