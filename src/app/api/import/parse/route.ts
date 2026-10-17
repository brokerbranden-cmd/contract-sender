import { NextRequest, NextResponse } from "next/server";
import { parseUpload } from "@/lib/spreadsheet";
import { detectMapping, missingRequired } from "@/lib/import-fields";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const name = file.name || "upload.csv";
  if (!/\.(csv|tsv|txt|xlsx|xls)$/i.test(name)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a .csv or .xlsx export." },
      { status: 400 }
    );
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const table = parseUpload(buf, name);
    if (table.headers.length === 0) {
      return NextResponse.json({ error: "File appears to be empty" }, { status: 400 });
    }
    const mapping = detectMapping(table.headers);
    return NextResponse.json({
      filename: name,
      headers: table.headers,
      rows: table.rows,
      total: table.rows.length,
      mapping,
      missing: missingRequired(mapping),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read file: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 }
    );
  }
}
