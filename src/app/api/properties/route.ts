import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const properties = await prisma.property.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { deals: true } } },
  });
  return NextResponse.json(properties);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const property = await prisma.property.create({
    data: {
      address: body.address,
      city: body.city,
      state: body.state || "FL",
      zip: body.zip,
      mlsNumber: body.mlsNumber || null,
      listPrice: body.listPrice != null ? Number(body.listPrice) : null,
      beds: body.beds != null ? Number(body.beds) : null,
      baths: body.baths != null ? Number(body.baths) : null,
      sqft: body.sqft != null ? Number(body.sqft) : null,
      yearBuilt: body.yearBuilt != null ? Number(body.yearBuilt) : null,
      propertyType: body.propertyType || "Single Family",
      notes: body.notes || null,
    },
  });
  return NextResponse.json(property, { status: 201 });
}
