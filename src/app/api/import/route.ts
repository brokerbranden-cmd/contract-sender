import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runImport } from "@/lib/import";
import { missingRequired, type ColumnMapping } from "@/lib/import-fields";

export const dynamic = "force-dynamic";

/** POST { rows: string[][], mapping, dryRun? } -> ImportSummary (dryRun = preview only, nothing written) */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows = body.rows as string[][];
  const mapping = (body.mapping ?? {}) as ColumnMapping;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  const missing = missingRequired(mapping);
  if (missing.length) {
    return NextResponse.json({ error: `Map required column(s): ${missing.join(", ")}` }, { status: 400 });
  }
  const summary = await runImport(prisma, {
    rows,
    mapping,
    dryRun: !!body.dryRun,
    source: body.filename ? `import:${String(body.filename).slice(0, 80)}` : "mls-import",
  });
  // keep payloads reasonable: preview returns the first 100 rows, commit the first 300
  const limit = summary.dryRun ? 100 : 300;
  return NextResponse.json({ ...summary, rows: summary.rows.slice(0, limit), rowsTruncated: summary.rows.length > limit });
}
