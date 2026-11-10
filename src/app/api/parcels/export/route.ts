import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CSV_COLUMNS, csvCell, exportRows } from "@/lib/parcels/search";

export const dynamic = "force-dynamic";

/** CSV export of the current search (or of selected ids). Capped at 100,000 rows. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rows = await exportRows(prisma, Array.isArray(body.criteria) ? body.criteria : [], {
    ids: Array.isArray(body.ids) ? body.ids.slice(0, 20000) : undefined,
    sort: body.sort,
    dir: body.dir,
    max: 100000,
  });
  const lines = [CSV_COLUMNS.map((c) => c.header).join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(r[c.prop])).join(","));
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="parcel-search-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
