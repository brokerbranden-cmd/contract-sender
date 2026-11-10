import type { Prisma, PrismaClient } from "@prisma/client";
import { COLUMN_MAP, FIELD_MAP, type Criterion, type FieldDef } from "./fields";

export type SearchRequest = {
  criteria: Criterion[];
  sort?: string; // column key
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type Built = { where: string; params: (string | number)[] };

const esc = (v: string) => v.replace(/[\\%_]/g, (m) => "\\" + m);
const list = (v: string | undefined) =>
  (v ?? "")
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);

function numVal(v: string | undefined, type: FieldDef["type"]): number | string | null {
  if (v == null || v.trim() === "") return null;
  const t = v.trim();
  if (type === "date") {
    // accept YYYY-MM-DD, YYYY-MM, YYYY, M/D/YYYY
    const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    return t;
  }
  const n = Number(t.replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Build one criterion's SQL; returns null when it is incomplete/ignorable. */
export function criterionSql(c: Criterion): { sql: string; params: (string | number)[] } | null {
  const f = FIELD_MAP[c.field];
  if (!f || f.stub) return null;
  const col = f.sql;
  const v = c.value ?? "";
  switch (f.type) {
    case "text": {
      switch (c.op) {
        case "empty":
          return { sql: `(${col} IS NULL OR ${col} = '')`, params: [] };
        case "notEmpty":
          return { sql: `(${col} IS NOT NULL AND ${col} <> '')`, params: [] };
        case "exact":
          return v.trim() ? { sql: `${col} = ? COLLATE NOCASE`, params: [v.trim()] } : null;
        case "notExact":
          return v.trim() ? { sql: `(${col} IS NULL OR ${col} <> ? COLLATE NOCASE)`, params: [v.trim()] } : null;
        case "startsWith":
          return v.trim() ? { sql: `${col} LIKE ? ESCAPE '\\'`, params: [esc(v.trim()) + "%"] } : null;
        case "notContains":
          return v.trim() ? { sql: `(${col} IS NULL OR ${col} NOT LIKE ? ESCAPE '\\')`, params: ["%" + esc(v.trim()) + "%"] } : null;
        case "multiContains": {
          const vs = list(v);
          return vs.length ? { sql: `(${vs.map(() => `${col} LIKE ? ESCAPE '\\'`).join(" OR ")})`, params: vs.map((x) => "%" + esc(x) + "%") } : null;
        }
        case "multiNotContains": {
          const vs = list(v);
          return vs.length
            ? { sql: `(${col} IS NULL OR (${vs.map(() => `${col} NOT LIKE ? ESCAPE '\\'`).join(" AND ")}))`, params: vs.map((x) => "%" + esc(x) + "%") }
            : null;
        }
        case "contains":
        default:
          return v.trim() ? { sql: `${col} LIKE ? ESCAPE '\\'`, params: ["%" + esc(v.trim()) + "%"] } : null;
      }
    }
    case "number":
    case "money":
    case "date": {
      const a = numVal(c.value, f.type);
      const b = numVal(c.value2, f.type);
      switch (c.op) {
        case "empty":
          return { sql: `${col} IS NULL`, params: [] };
        case "notEmpty":
          return { sql: `${col} IS NOT NULL`, params: [] };
        case "between":
          if (a != null && b != null) return { sql: `${col} BETWEEN ? AND ?`, params: [a, b] };
          if (a != null) return { sql: `${col} >= ?`, params: [a] };
          if (b != null) return { sql: `${col} <= ?`, params: [b] };
          return null;
        case "multiple": {
          const vs = list(v).map((x) => numVal(x, f.type)).filter((x): x is number | string => x != null);
          return vs.length ? { sql: `${col} IN (${vs.map(() => "?").join(",")})`, params: vs } : null;
        }
        case "eq":
          if (a == null) return null;
          // a bare year/month matches the whole period for dates
          if (f.type === "date" && typeof a === "string" && /^\d{4}(-\d{2})?$/.test(a)) return { sql: `${col} LIKE ?`, params: [a + "%"] };
          return { sql: `${col} = ?`, params: [a] };
        case "gt":
          return a != null ? { sql: `${col} > ?`, params: [a] } : null;
        case "gte":
          return a != null ? { sql: `${col} >= ?`, params: [a] } : null;
        case "lt":
          return a != null ? { sql: `${col} < ?`, params: [a] } : null;
        case "lte":
          return a != null ? { sql: `${col} <= ?`, params: [a] } : null;
        default:
          return null;
      }
    }
    case "bool": {
      if (v === "true" || v === "yes" || v === "1") return { sql: `(${col}) = 1`, params: [] };
      if (v === "false" || v === "no" || v === "0") return { sql: `COALESCE((${col}), 0) = 0`, params: [] };
      return null;
    }
    case "enum": {
      if (c.op === "empty") return { sql: `(${col} IS NULL OR ${col} = '')`, params: [] };
      if (c.op === "notEmpty") return { sql: `(${col} IS NOT NULL AND ${col} <> '')`, params: [] };
      const vs = list(v);
      if (!vs.length) return null;
      const ph = vs.map(() => "?").join(",");
      return c.op === "notIn" ? { sql: `(${col} IS NULL OR ${col} NOT IN (${ph}))`, params: vs } : { sql: `${col} IN (${ph})`, params: vs };
    }
  }
}

export function buildWhere(criteria: Criterion[]): Built {
  const parts: string[] = [];
  const params: (string | number)[] = [];
  for (const c of criteria ?? []) {
    const r = criterionSql(c);
    if (!r) continue;
    parts.push(r.sql);
    params.push(...r.params);
  }
  return { where: parts.length ? parts.join(" AND ") : "1=1", params };
}

const YEARS_OWNED_SELECT = `(CASE WHEN p."lastSaleDate" IS NULL THEN NULL ELSE (julianday('now') - julianday(p."lastSaleDate")) / 365.25 END) AS yearsOwned`;

export type ParcelItem = Record<string, unknown> & {
  id: string;
  parcelId: string;
  county: string;
  situsAddress: string;
  ownerMailing: string;
  mls: { id: string; status: string | null; listPrice: number | null } | null;
  dealId: string | null;
};

const bigToNum = (rows: Record<string, unknown>[]) =>
  rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) o[k] = typeof v === "bigint" ? Number(v) : v;
    return o;
  });

export function normalizePid(s: string | null | undefined) {
  return (s ?? "").replace(/[-\s.]/g, "");
}

export async function searchParcels(db: PrismaClient, req: SearchRequest) {
  const pageSize = [25, 50, 100, 250].includes(req.pageSize ?? 0) ? (req.pageSize as number) : 50;
  const page = Math.max(1, Math.floor(req.page ?? 1));
  const { where, params } = buildWhere(req.criteria);
  const col = COLUMN_MAP[req.sort ?? ""] ?? COLUMN_MAP.address;
  const dir = req.dir === "desc" ? "DESC" : "ASC";
  const total = Number(
    ((await db.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "Parcel" p WHERE ${where}`, ...params)) as { n: bigint | number }[])[0].n,
  );
  const rows = bigToNum(
    (await db.$queryRawUnsafe(
      `SELECT p.*, ${YEARS_OWNED_SELECT} FROM "Parcel" p WHERE ${where} ORDER BY (NULLIF(${col.sort}, '') IS NULL), ${col.sort} ${dir}, p."id" LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      (page - 1) * pageSize,
    )) as Record<string, unknown>[],
  );
  const items = await decorate(db, rows);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Add MLS listing + existing-deal info to a page of parcel rows. */
export async function decorate(db: PrismaClient, rows: Record<string, unknown>[]): Promise<ParcelItem[]> {
  const pids = rows.map((r) => String(r.parcelId));
  const props = pids.length
    ? await db.property.findMany({
        where: { OR: [{ parcelId: { in: pids } }, { address: { in: rows.map((r) => String(r.situsAddress)) } }] },
        select: { id: true, parcelId: true, address: true, status: true, listPrice: true, mlsNumber: true, source: true, deals: { select: { id: true }, take: 1, orderBy: { createdAt: "desc" } } },
      })
    : [];
  return rows.map((r) => {
    const pid = normalizePid(String(r.parcelId));
    const addr = String(r.situsAddress).toUpperCase();
    const match = props.find((p) => normalizePid(p.parcelId) === pid) ?? props.find((p) => !!p.mlsNumber && p.address.toUpperCase() === addr);
    return {
      ...r,
      ownerMailing: [r.ownerAddr1, r.ownerCity, r.ownerState, r.ownerZip].filter(Boolean).join(", "),
      mls: match && match.mlsNumber ? { id: match.id, status: match.status, listPrice: match.listPrice } : null,
      dealId: match?.deals[0]?.id ?? null,
    } as ParcelItem;
  });
}

export async function searchIds(db: PrismaClient, criteria: Criterion[], max = 5000): Promise<string[]> {
  const { where, params } = buildWhere(criteria);
  const rows = (await db.$queryRawUnsafe(`SELECT p."id" AS id FROM "Parcel" p WHERE ${where} LIMIT ?`, ...params, max)) as { id: string }[];
  return rows.map((r) => r.id);
}

export const CSV_COLUMNS: { header: string; prop: string }[] = [
  { header: "Folio", prop: "parcelId" },
  { header: "County", prop: "county" },
  { header: "Address", prop: "situsAddress" },
  { header: "City", prop: "situsCity" },
  { header: "Zip", prop: "situsZip" },
  { header: "Type", prop: "propertyType" },
  { header: "Beds", prop: "beds" },
  { header: "Baths", prop: "baths" },
  { header: "Living Area", prop: "livingArea" },
  { header: "Gross Area", prop: "grossArea" },
  { header: "Lot Sqft", prop: "lotSqft" },
  { header: "Year Built", prop: "yearBuilt" },
  { header: "Last Sale Date", prop: "lastSaleDate" },
  { header: "Last Sale Price", prop: "lastSalePrice" },
  { header: "Land Value", prop: "landValue" },
  { header: "Build Value", prop: "buildingValue" },
  { header: "Market (Just) Value", prop: "justValue" },
  { header: "Assessed Value", prop: "assessedValue" },
  { header: "Taxable Value", prop: "taxableValue" },
  { header: "$/Sqft", prop: "ppsf" },
  { header: "Est. Equity", prop: "estEquity" },
  { header: "Est. Equity %", prop: "estEquityPct" },
  { header: "Homestead", prop: "homestead" },
  { header: "Absentee", prop: "absentee" },
  { header: "Owner", prop: "ownerName" },
  { header: "Owner Address", prop: "ownerAddr1" },
  { header: "Owner Address 2", prop: "ownerAddr2" },
  { header: "Owner City", prop: "ownerCity" },
  { header: "Owner State", prop: "ownerState" },
  { header: "Owner Zip", prop: "ownerZip" },
  { header: "Legal", prop: "legal" },
  { header: "Lat", prop: "lat" },
  { header: "Lon", prop: "lon" },
];

export function csvCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "bigint") return String(v);
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportRows(db: PrismaClient, criteria: Criterion[], opts: { ids?: string[]; sort?: string; dir?: "asc" | "desc"; max?: number }) {
  const max = Math.min(opts.max ?? 100000, 250000);
  const col = COLUMN_MAP[opts.sort ?? ""] ?? COLUMN_MAP.address;
  const dir = opts.dir === "desc" ? "DESC" : "ASC";
  let where: string;
  let params: (string | number)[];
  if (opts.ids?.length) {
    where = `p."id" IN (${opts.ids.map(() => "?").join(",")})`;
    params = opts.ids;
  } else ({ where, params } = buildWhere(criteria));
  const rows = (await db.$queryRawUnsafe(
    `SELECT p.* FROM "Parcel" p WHERE ${where} ORDER BY (NULLIF(${col.sort}, '') IS NULL), ${col.sort} ${dir}, p."id" LIMIT ?`,
    ...params,
    max,
  )) as Record<string, unknown>[];
  return bigToNum(rows);
}

export type { Prisma };
