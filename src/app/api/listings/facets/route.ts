import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingFacets } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listingFacets(prisma));
}
