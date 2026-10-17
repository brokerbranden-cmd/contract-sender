import * as XLSX from "xlsx";
import { parseCsv, toTable, type ParsedTable } from "./csv";

/** Parse an uploaded CSV / TSV / XLS / XLSX file into headers + rows (all strings). */
export function parseUpload(buffer: Buffer, filename: string): ParsedTable {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { headers: [], rows: [] };
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false, // use formatted text so "$425,000" / dates stay as displayed
      defval: "",
      blankrows: false,
    });
    return toTable(
      raw.map((r) => (r as unknown[]).map((c) => (c == null ? "" : String(c))))
    );
  }
  return toTable(parseCsv(buffer.toString("utf8")));
}
