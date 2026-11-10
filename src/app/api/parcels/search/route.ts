import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchParcels } from "@/lib/parcels/search";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const res = await searchParcels(prisma, {
      criteria: Array.isArray(body.criteria) ? body.criteria : [],
      sort: body.sort,
      dir: body.dir,
      page: body.page,
      pageSize: body.pageSize,
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
