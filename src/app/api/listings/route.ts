import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFilters, presentListing, searchListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = await searchListings(prisma, parseFilters(sp), {
    sort: sp.get("sort") ?? undefined,
    dir: sp.get("dir") ?? undefined,
    page: Number(sp.get("page") ?? 1) || 1,
    pageSize: Number(sp.get("pageSize") ?? 25) || 25,
  });
  return NextResponse.json({ ...result, items: result.items.map(presentListing) });
}
