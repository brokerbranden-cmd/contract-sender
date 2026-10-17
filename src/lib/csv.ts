/**
 * Minimal RFC-4180 CSV parser (no dependencies). Handles quoted fields,
 * escaped quotes (""), embedded newlines (MLS remarks!), BOM, CRLF/LF, and
 * semicolon/tab delimiters (auto-detected from the header line).
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && field === "") {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop fully empty rows
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  // ignore delimiters inside quotes
  const stripped = firstLine.replace(/"[^"]*"/g, "");
  const counts: [string, number][] = [
    [",", (stripped.match(/,/g) || []).length],
    ["\t", (stripped.match(/\t/g) || []).length],
    [";", (stripped.match(/;/g) || []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export type ParsedTable = { headers: string[]; rows: string[][] };

/** Turn raw rows into headers + body rows (first non-empty row = header). */
export function toTable(raw: string[][]): ParsedTable {
  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = raw[0].map((h) => h.trim());
  const rows = raw.slice(1).map((r) => {
    const out = r.slice(0, headers.length).map((c) => c ?? "");
    while (out.length < headers.length) out.push("");
    return out;
  });
  return { headers, rows };
}
