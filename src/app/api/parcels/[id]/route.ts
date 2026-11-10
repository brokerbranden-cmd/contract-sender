import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parcelDetail } from "@/lib/parcels/detail";
import { ensureDealForParcel } from "@/lib/parcels/crm";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const d = await parcelDetail(prisma, decodeURIComponent(params.id));
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(d);
}

/** "Make offer": find/create the CRM property + deal for this parcel and return the deal id. */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const p = await prisma.parcel.findUnique({ where: { id: decodeURIComponent(params.id) } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await ensureDealForParcel(prisma, p);
  return NextResponse.json({ dealId: r.deal.id, propertyId: r.property.id, created: r.created });
}
