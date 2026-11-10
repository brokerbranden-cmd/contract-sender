import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchIds } from "@/lib/parcels/search";

export const dynamic = "force-dynamic";

/** All parcel ids matching the criteria (capped) — used by "select all N results". */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const max = Math.min(Number(body.max) || 5000, 5000);
  const ids = await searchIds(prisma, Array.isArray(body.criteria) ? body.criteria : [], max);
  return NextResponse.json({ ids, capped: ids.length >= max });
}
