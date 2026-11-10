import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDealForParcel, ensurePropertyForParcel } from "@/lib/parcels/crm";

export const dynamic = "force-dynamic";

/**
 * Bulk "Add to Follow Up" (creates a deal per parcel at stage "new") or, with
 * mode "properties", only creates/links Property records and returns their ids
 * (used to feed the existing bulk-offer flow).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.slice(0, 500) : [];
  if (!ids.length) return NextResponse.json({ error: "No parcels selected" }, { status: 400 });
  const mode = body.mode === "properties" ? "properties" : "deals";
  const parcels = await prisma.parcel.findMany({ where: { id: { in: ids } } });
  const out: { parcelId: string; propertyId: string; dealId?: string; created?: boolean; address: string }[] = [];
  for (const p of parcels) {
    if (mode === "properties") {
      const prop = await ensurePropertyForParcel(prisma, p);
      out.push({ parcelId: p.id, propertyId: prop.id, address: prop.address });
    } else {
      const r = await ensureDealForParcel(prisma, p);
      out.push({ parcelId: p.id, propertyId: r.property.id, dealId: r.deal.id, created: r.created, address: r.property.address });
    }
  }
  return NextResponse.json({
    items: out,
    created: out.filter((o) => o.created).length,
    existing: out.filter((o) => o.created === false).length,
  });
}
