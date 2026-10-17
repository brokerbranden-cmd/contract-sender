import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingIds, parseFilters } from "@/lib/listings";

export const dynamic = "force-dynamic";

/** All property ids matching the current filters (for "select all filtered"). */
export async function GET(req: NextRequest) {
  const ids = await listingIds(prisma, parseFilters(req.nextUrl.searchParams));
  return NextResponse.json({ ids });
}
