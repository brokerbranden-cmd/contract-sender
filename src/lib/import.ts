import type { Prisma, PrismaClient } from "@prisma/client";
import type { ColumnMapping, ImportFieldKey } from "./import-fields";

/* ------------------------------------------------------------------ */
/* Value parsers (exported for tests)                                  */
/* ------------------------------------------------------------------ */

export function clean(v: unknown): string {
  return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
}

export function parseMoney(v: string): number | null {
  const s = v.replace(/[$,\s]/g, "");
  if (!s) return null;
  const m = s.match(/^-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function parseIntLoose(v: string): number | null {
  const n = parseMoney(v);
  return n == null ? null : Math.round(n);
}

export function parseBool(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (/^(n|no|none|false|0|f|n\/a|na|-|unknown)$/.test(s) || /^(no|not|none)\b/.test(s))
    return false;
  return true;
}

export function parseDate(v: string): Date | null {
  const s = v.trim();
  if (!s) return null;
  let d: Date | null = null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > 50 ? 1900 : 2000;
    d = new Date(Date.UTC(y, Number(m[1]) - 1, Number(m[2])));
  } else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  } else if (/^\d{5}(\.\d+)?$/.test(s)) {
    // Excel serial date (days since 1899-12-30)
    d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
  } else {
    d = new Date(s);
  }
  if (!d || isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y >= 1990 && y <= 2100 ? d : null;
}

export function parseZip(v: string): string {
  const m = v.match(/\d{5}/);
  return m ? m[0] : "";
}

const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
export function parseEmail(v: string): string {
  const m = v.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : "";
}

export function digits(v: string): string {
  return v.replace(/\D/g, "");
}

/* ------------------------------------------------------------------ */
/* Row normalisation                                                   */
/* ------------------------------------------------------------------ */

export type NormalizedListing = {
  mlsNumber: string;
  status: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  parcelId: string;
  legalDescription: string;
  area: string;
  subdivision: string;
  listPrice: number | null;
  originalListPrice: number | null;
  beds: number | null;
  baths: number | null;
  halfBaths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  pool: boolean | null;
  waterfront: boolean | null;
  dom: number | null;
  listDate: Date | null;
  isShortSale: boolean | null;
  isReo: boolean | null;
  remarks: string;
  showingInstructions: string;
  agentName: string;
  agentEmail: string;
  agentPhone: string;
  officeName: string;
  officePhone: string;
};

export function normalizeRow(
  row: string[],
  mapping: ColumnMapping
): NormalizedListing {
  const get = (k: ImportFieldKey): string => {
    const idx = mapping[k];
    if (idx == null || idx < 0) return "";
    return clean(row[idx]);
  };
  // remarks keep their line breaks collapsed (clean) – fine for display.

  let address = get("address");
  let city = get("city");
  let state = get("state");
  let zip = parseZip(get("zip"));

  if (!address) {
    address = [
      get("streetNumber"),
      get("streetDir"),
      get("streetName"),
      get("streetSuffix"),
    ]
      .filter(Boolean)
      .join(" ");
  }
  const unit = get("unit");
  if (address && unit && !/\b(unit|apt|#|ste|suite)\b/i.test(address)) {
    address = `${address} ${/^#/.test(unit) ? unit : `#${unit}`}`;
  }

  // "123 Main St, Miami, FL 33101" style single-column addresses
  if (address.includes(",") && !city) {
    const parts = address.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const tail = parts[parts.length - 1];
      const m = tail.match(/^([A-Za-z]{2})\s*(\d{5})?/);
      if (m) {
        state = state || m[1].toUpperCase();
        zip = zip || (m[2] ?? "");
        city = parts[parts.length - 2];
        address = parts.slice(0, parts.length - 2).join(", ");
      }
    } else if (parts.length === 2) {
      const m = parts[1].match(/^(.*?)(?:,?\s+([A-Za-z]{2}))?\s*(\d{5})?$/);
      if (m && m[1]) {
        city = m[1];
        state = state || (m[2] ?? "").toUpperCase();
        zip = zip || (m[3] ?? "");
        address = parts[0];
      }
    }
  }

  const full = parseIntLoose(get("fullBaths"));
  const half = parseIntLoose(get("halfBaths"));
  let baths: number | null = null;
  const totalBaths = parseMoney(get("totalBaths"));
  if (totalBaths != null) baths = totalBaths;
  else if (full != null || half != null) baths = (full ?? 0) + (half ?? 0) * 0.5;

  return {
    mlsNumber: get("mlsNumber"),
    status: get("status"),
    address,
    city,
    state: (state || "FL").toUpperCase().slice(0, 2),
    zip,
    county: get("county"),
    parcelId: get("parcelId"),
    legalDescription: get("legalDescription"),
    area: get("area"),
    subdivision: get("subdivision"),
    listPrice: parseMoney(get("listPrice")),
    originalListPrice: parseMoney(get("originalListPrice")),
    beds: parseIntLoose(get("beds")),
    baths,
    halfBaths: half,
    sqft: parseIntLoose(get("sqft")),
    lotSqft: parseIntLoose(get("lotSqft")),
    yearBuilt: parseIntLoose(get("yearBuilt")),
    propertyType: get("propertyType"),
    pool: parseBool(get("pool")),
    waterfront: parseBool(get("waterfront")),
    dom: parseIntLoose(get("dom")),
    listDate: parseDate(get("listDate")),
    isShortSale: parseBool(get("shortSale")),
    isReo: parseBool(get("reo")),
    remarks: get("remarks"),
    showingInstructions: get("showingInstructions"),
    agentName: get("agentName"),
    agentEmail: parseEmail(get("agentEmail")),
    agentPhone: get("agentPhone"),
    officeName: get("officeName"),
    officePhone: get("officePhone"),
  };
}

export function addressKey(address: string, zip: string): string {
  return `${address.toLowerCase().replace(/[^a-z0-9]/g, "")}|${zip}`;
}

/* ------------------------------------------------------------------ */
/* Import runner                                                       */
/* ------------------------------------------------------------------ */

export type RowAction = "create" | "update" | "skip";

export type ImportRowResult = {
  row: number; // spreadsheet row number (header = 1)
  action: RowAction;
  reason?: string;
  address: string;
  city: string;
  zip: string;
  mlsNumber: string;
  listPrice: number | null;
  status: string;
  agentName: string;
  agentEmail: string;
  missingAgentEmail: boolean;
};

export type ImportSummary = {
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  missingAgentEmail: number;
  agentsCreated: number;
  agentsUpdated: number;
  dealsCreated: number;
  rows: ImportRowResult[];
  skippedRows: { row: number; reason: string }[];
};

type Db = PrismaClient | Prisma.TransactionClient;

export async function runImport(
  prisma: PrismaClient,
  input: { rows: string[][]; mapping: ColumnMapping; dryRun?: boolean; source?: string }
): Promise<ImportSummary> {
  const dryRun = !!input.dryRun;
  if (dryRun) return doImport(prisma, input, true);
  return prisma.$transaction((tx) => doImport(tx, input, false), {
    timeout: 5 * 60 * 1000,
    maxWait: 30 * 1000,
  });
}

async function doImport(
  db: Db,
  input: { rows: string[][]; mapping: ColumnMapping; source?: string },
  dryRun: boolean
): Promise<ImportSummary> {
  const settings = await db.settings.findUnique({ where: { id: "default" } });

  const propsAll = await db.property.findMany({
    select: { id: true, mlsNumber: true, address: true, zip: true },
  });
  const byMls = new Map<string, string>();
  const byAddr = new Map<string, string>();
  for (const p of propsAll) {
    if (p.mlsNumber) byMls.set(p.mlsNumber.trim().toLowerCase(), p.id);
    byAddr.set(addressKey(p.address, p.zip), p.id);
  }

  const agentsAll = await db.agent.findMany({
    select: { id: true, name: true, email: true, phone: true },
  });
  const agentByEmail = new Map<string, string>();
  const agentByNamePhone = new Map<string, { id: string; email: string | null }>();
  const namePhoneKey = (name: string, phone: string) =>
    `${name.toLowerCase().replace(/[^a-z]/g, "")}|${digits(phone)}`;
  for (const a of agentsAll) {
    if (a.email) agentByEmail.set(a.email.trim().toLowerCase(), a.id);
    agentByNamePhone.set(namePhoneKey(a.name, a.phone ?? ""), {
      id: a.id,
      email: a.email,
    });
  }

  const dealsAll = await db.deal.findMany({ select: { propertyId: true } });
  const propsWithDeal = new Set(dealsAll.map((d) => d.propertyId));

  const summary: ImportSummary = {
    dryRun,
    totalRows: input.rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    missingAgentEmail: 0,
    agentsCreated: 0,
    agentsUpdated: 0,
    dealsCreated: 0,
    rows: [],
    skippedRows: [],
  };

  const agentsCreatedSet = new Set<string>();
  const agentsUpdatedSet = new Set<string>();
  let fakeId = 0;
  const now = new Date();

  for (let i = 0; i < input.rows.length; i++) {
    const rowNum = i + 2;
    const n = normalizeRow(input.rows[i], input.mapping);
    const base = {
      row: rowNum,
      address: n.address,
      city: n.city,
      zip: n.zip,
      mlsNumber: n.mlsNumber,
      listPrice: n.listPrice,
      status: n.status,
      agentName: n.agentName,
      agentEmail: n.agentEmail,
      missingAgentEmail: !n.agentEmail,
    };

    if (!n.address) {
      summary.skipped++;
      summary.skippedRows.push({ row: rowNum, reason: "Missing address" });
      summary.rows.push({ ...base, action: "skip", reason: "Missing address" });
      continue;
    }

    if (!n.agentEmail) summary.missingAgentEmail++;

    /* ---- agent ---- */
    let agentId: string | null = null;
    if (n.agentEmail || n.agentName) {
      const agentFields = {
        name: n.agentName || undefined,
        phone: n.agentPhone || undefined,
        brokerage: n.officeName || undefined,
        officePhone: n.officePhone || undefined,
      };
      let existingId: string | undefined;
      let existingHasEmail = true;
      if (n.agentEmail) existingId = agentByEmail.get(n.agentEmail);
      if (!existingId && n.agentName) {
        const hit = agentByNamePhone.get(namePhoneKey(n.agentName, n.agentPhone));
        // only fall back to name+phone if incoming has no email, or the match has none
        if (hit && (!n.agentEmail || !hit.email)) {
          existingId = hit.id;
          existingHasEmail = !!hit.email;
        }
      }
      if (existingId) {
        agentId = existingId;
        if (!dryRun) {
          await db.agent.update({
            where: { id: existingId },
            data: {
              ...agentFields,
              ...(n.agentEmail && !existingHasEmail ? { email: n.agentEmail } : {}),
            },
          });
        }
        if (n.agentEmail) agentByEmail.set(n.agentEmail, existingId);
        if (!agentsCreatedSet.has(existingId)) agentsUpdatedSet.add(existingId);
      } else if (n.agentEmail || n.agentName) {
        const name = n.agentName || n.agentEmail.split("@")[0];
        if (dryRun) {
          agentId = `dry-${++fakeId}`;
        } else {
          const created = await db.agent.create({
            data: {
              name,
              email: n.agentEmail || null,
              phone: n.agentPhone || null,
              brokerage: n.officeName || null,
              officePhone: n.officePhone || null,
            },
          });
          agentId = created.id;
        }
        if (n.agentEmail) agentByEmail.set(n.agentEmail, agentId);
        agentByNamePhone.set(namePhoneKey(name, n.agentPhone), {
          id: agentId,
          email: n.agentEmail || null,
        });
        agentsCreatedSet.add(agentId);
      }
    }

    /* ---- property ---- */
    let propId: string | undefined;
    if (n.mlsNumber) propId = byMls.get(n.mlsNumber.toLowerCase());
    if (!propId) propId = byAddr.get(addressKey(n.address, n.zip));

    const data = {
      ...(n.mlsNumber && { mlsNumber: n.mlsNumber }),
      ...(n.status && { status: n.status }),
      address: n.address,
      ...(n.city && { city: n.city }),
      ...(n.state && { state: n.state }),
      ...(n.zip && { zip: n.zip }),
      ...(n.county && { county: n.county }),
      ...(n.parcelId && { parcelId: n.parcelId }),
      ...(n.legalDescription && { legalDescription: n.legalDescription }),
      ...(n.area && { area: n.area }),
      ...(n.subdivision && { subdivision: n.subdivision }),
      ...(n.listPrice != null && { listPrice: n.listPrice }),
      ...(n.originalListPrice != null && { originalListPrice: n.originalListPrice }),
      ...(n.beds != null && { beds: n.beds }),
      ...(n.baths != null && { baths: n.baths }),
      ...(n.halfBaths != null && { halfBaths: n.halfBaths }),
      ...(n.sqft != null && { sqft: n.sqft }),
      ...(n.lotSqft != null && { lotSqft: n.lotSqft }),
      ...(n.yearBuilt != null && { yearBuilt: n.yearBuilt }),
      ...(n.propertyType && { propertyType: n.propertyType }),
      ...(n.pool != null && { pool: n.pool }),
      ...(n.waterfront != null && { waterfront: n.waterfront }),
      ...(n.dom != null && { dom: n.dom }),
      ...(n.listDate && { listDate: n.listDate }),
      ...(n.isShortSale != null && { isShortSale: n.isShortSale }),
      ...(n.isReo != null && { isReo: n.isReo }),
      ...(n.remarks && { remarks: n.remarks }),
      ...(n.showingInstructions && { showingInstructions: n.showingInstructions }),
      ...(n.officeName && { listOfficeName: n.officeName }),
      ...(n.officePhone && { listOfficePhone: n.officePhone }),
      ...(agentId && !dryRun && { listAgentId: agentId }),
      source: input.source ?? "mls-import",
      importedAt: now,
    };

    let action: RowAction;
    if (propId) {
      action = "update";
      if (!dryRun) await db.property.update({ where: { id: propId }, data });
      summary.updated++;
    } else {
      action = "create";
      if (dryRun) {
        propId = `dry-${++fakeId}`;
      } else {
        const created = await db.property.create({
          data: { ...data, city: n.city || "", zip: n.zip || "" },
        });
        propId = created.id;
      }
      if (n.mlsNumber) byMls.set(n.mlsNumber.toLowerCase(), propId);
      byAddr.set(addressKey(n.address, n.zip), propId);
      summary.created++;
    }

    /* ---- deal ---- */
    if (!propsWithDeal.has(propId)) {
      if (!dryRun) {
        await db.deal.create({
          data: {
            title: `${n.address}${n.city ? `, ${n.city}` : ""}`,
            stage: "new",
            propertyId: propId,
            agentId,
            earnestMoney: settings?.defaultEarnest ?? 1000,
            closingDays: settings?.defaultClosingDays ?? 30,
            inspectionDays: settings?.defaultInspectionDays ?? 10,
            financingType: "Cash",
          },
        });
      }
      propsWithDeal.add(propId);
      summary.dealsCreated++;
    } else if (agentId && !dryRun) {
      // attach agent to existing deals that don't have one yet
      await db.deal.updateMany({
        where: { propertyId: propId, agentId: null },
        data: { agentId },
      });
    }

    summary.rows.push({ ...base, action });
  }

  summary.agentsCreated = agentsCreatedSet.size;
  summary.agentsUpdated = agentsUpdatedSet.size;
  return summary;
}
