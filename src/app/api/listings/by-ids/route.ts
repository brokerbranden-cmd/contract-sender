import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingInclude, presentListing } from "@/lib/listings";

export const dynamic = "force-dynamic";

/** POST { ids: string[] } -> listings (used by the bulk offer builder). */
export async function POST(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ items: [] });
  }
  const props = await prisma.property.findMany({
    where: { id: { in: ids.slice(0, 1000) } },
    include: listingInclude,
  });
  const order = new Map<string, number>(ids.map((id: string, i: number) => [id, i]));
  props.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return NextResponse.json({ items: props.map(presentListing) });
}
