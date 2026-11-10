import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT county, COUNT(*) AS n, MAX(assessYear) AS year, MAX(importedAt) AS importedAt,
            SUM(CASE WHEN lat IS NOT NULL THEN 1 ELSE 0 END) AS withGeo,
            SUM(CASE WHEN beds IS NOT NULL THEN 1 ELSE 0 END) AS withBeds
     FROM "Parcel" GROUP BY county ORDER BY county`,
  )) as Record<string, unknown>[];
  const counties = rows.map((r) => ({
    county: r.county as string,
    count: Number(r.n),
    year: r.year == null ? null : Number(r.year),
    importedAt: r.importedAt == null ? null : new Date(Number(r.importedAt)).toISOString(),
    withGeo: Number(r.withGeo),
    withBeds: Number(r.withBeds),
  }));
  return NextResponse.json({ counties, total: counties.reduce((a, c) => a + c.count, 0) });
}
