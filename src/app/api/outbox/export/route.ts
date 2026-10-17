import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportBatch } from "@/lib/outbox";

export const dynamic = "force-dynamic";

/**
 * GET /api/outbox/export?ids=a,b,c&ignoreCap=1&includeExported=1
 * Downloads outbox-batch.json (ready items with an email, limited by the daily cap).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ids = (sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const batch = await exportBatch(prisma, {
    ids: ids.length ? ids : undefined,
    ignoreCap: sp.get("ignoreCap") === "1",
    includeExported: sp.get("includeExported") === "1",
  });
  return new NextResponse(JSON.stringify(batch, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="outbox-batch.json"',
      "Cache-Control": "no-store",
    },
  });
}
