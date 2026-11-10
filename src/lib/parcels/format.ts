import type { ColumnDef } from "./fields";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  if (!y || !m) return v;
  return d === "01" ? `${m}/${y}` : `${m}/${d}/${y}`;
}

export function fmtCell(col: Pick<ColumnDef, "fmt">, v: unknown): string {
  if (v == null || v === "") return "";
  switch (col.fmt) {
    case "money":
      return usd.format(Number(v));
    case "ppsf":
      return "$" + Number(v).toFixed(0);
    case "int":
      return int.format(Number(v));
    case "num":
      return Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 });
    case "pct":
      return `${Number(v).toFixed(0)}%`;
    case "bool":
      return v === true || v === 1 ? "Yes" : v === false || v === 0 ? "No" : "";
    case "date":
      return fmtDate(String(v));
    default:
      return String(v);
  }
}
export { usd, int };
