import { PrismaClient } from "@prisma/client";
import type { Readable } from "stream";
import { csvRecords } from "./csv-stream";
import { mapNalRow, mapSdfRow, type ParcelRow, type SaleRow } from "./nal";
import type { CountyInfo } from "./counties";

type Log = (m: string) => void;

async function* records(stream: Readable): AsyncGenerator<Record<string, string>> {
  let header: string[] | null = null;
  for await (const rec of csvRecords(stream)) {
    if (!header) {
      header = rec.map((h) => h.trim().toUpperCase());
      continue;
    }
    const o: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) o[header[i]] = rec[i] ?? "";
    yield o;
  }
}

/** Prisma client tuned for bulk loading (single connection so PRAGMAs stick). */
export function bulkClient(): PrismaClient {
  const base = process.env.DATABASE_URL || "file:./dev.db";
  const url = base.includes("connection_limit") ? base : base + (base.includes("?") ? "&" : "?") + "connection_limit=1";
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function beginBulk(prisma: PrismaClient) {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL");
  await prisma.$queryRawUnsafe("PRAGMA synchronous=OFF");
  await prisma.$queryRawUnsafe("PRAGMA temp_store=MEMORY");
  await prisma.$queryRawUnsafe("PRAGMA cache_size=-200000");
}

type IdxDef = { name: string; sql: string };

export async function dropSecondaryIndexes(prisma: PrismaClient, table: string): Promise<IdxDef[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL AND name LIKE '%_idx'`,
    table,
  )) as IdxDef[];
  for (const r of rows) await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${r.name}"`);
  return rows;
}

export async function recreateIndexes(prisma: PrismaClient, defs: IdxDef[]) {
  for (const d of defs) await prisma.$executeRawUnsafe(d.sql.replace(/^CREATE INDEX/i, "CREATE INDEX IF NOT EXISTS"));
}

export type ImportResult = { parcels: number; skipped: number; sales: number; seconds: number };

export async function importCounty(opts: {
  prisma: PrismaClient;
  county: CountyInfo;
  nal: () => Promise<Readable>;
  sdf?: () => Promise<Readable>;
  limit?: number;
  batchSize?: number;
  keepIndexes?: boolean;
  log?: Log;
}): Promise<ImportResult> {
  const { prisma, county } = opts;
  const log = opts.log ?? (() => {});
  const batchSize = opts.batchSize ?? 400;
  const t0 = Date.now();
  await beginBulk(prisma);

  const parcelIdx = opts.keepIndexes ? [] : await dropSecondaryIndexes(prisma, "Parcel");
  log(`Clearing existing ${county.name} parcels…`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Parcel" WHERE county = ?`, county.slug);

  let batch: ParcelRow[] = [];
  let parcels = 0;
  let skipped = 0;
  const flush = async () => {
    if (!batch.length) return;
    await prisma.parcel.createMany({ data: batch as never });
    parcels += batch.length;
    batch = [];
    if (parcels % 20000 < batchSize) log(`  ${parcels.toLocaleString()} parcels loaded`);
  };
  const today = new Date();
  try {
    for await (const rec of records(await opts.nal())) {
      const row = mapNalRow(rec, county, today);
      if (!row) {
        skipped++;
        continue;
      }
      batch.push(row);
      if (batch.length >= batchSize) await flush();
      if (opts.limit && parcels + batch.length >= opts.limit) break;
    }
    await flush();
  } finally {
    log(`Rebuilding indexes…`);
    await recreateIndexes(prisma, parcelIdx);
  }

  let sales = 0;
  if (opts.sdf) {
    log(`Loading sales (SDF)…`);
    const saleIdx = opts.keepIndexes ? [] : await dropSecondaryIndexes(prisma, "ParcelSale");
    await prisma.$executeRawUnsafe(`DELETE FROM "ParcelSale" WHERE county = ?`, county.slug);
    let sb: SaleRow[] = [];
    const sflush = async () => {
      if (!sb.length) return;
      await prisma.parcelSale.createMany({ data: sb });
      sales += sb.length;
      sb = [];
    };
    try {
      for await (const rec of records(await opts.sdf())) {
        const row = mapSdfRow(rec, county);
        if (!row) continue;
        sb.push(row);
        if (sb.length >= 1000) await sflush();
      }
      await sflush();
    } finally {
      await recreateIndexes(prisma, saleIdx);
    }
  }

  const fixed = await fixUnincorporatedCities(prisma, county.slug);
  if (fixed) log(`Set postal city on ${fixed.toLocaleString()} unincorporated parcels (by ZIP)`);
  await prisma.$executeRawUnsafe("ANALYZE");
  return { parcels, skipped, sales, seconds: Math.round((Date.now() - t0) / 1000) };
}

/**
 * Miami-Dade (and a few others) label most parcels' city as the municipality, i.e.
 * "Unincorporated County". Replace that with the postal city most common for the
 * parcel's ZIP among parcels that do name a city (approximation, good enough for
 * "city contains Miami" style filtering).
 */
export async function fixUnincorporatedCities(prisma: PrismaClient, countySlug: string): Promise<number> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT situsZip AS zip, situsCity AS city, COUNT(*) AS n FROM "Parcel"
     WHERE county = ? AND situsZip <> '' AND situsCity <> '' AND UPPER(situsCity) NOT LIKE 'UNINCORP%'
     GROUP BY situsZip, situsCity`,
    countySlug,
  )) as { zip: string; city: string; n: bigint | number }[];
  const best = new Map<string, { city: string; n: number }>();
  for (const r of rows) {
    const n = Number(r.n);
    const cur = best.get(r.zip);
    if (!cur || n > cur.n) best.set(r.zip, { city: r.city, n });
  }
  let changed = 0;
  for (const [zip, b] of Array.from(best)) {
    changed += Number(
      await prisma.$executeRawUnsafe(
        `UPDATE "Parcel" SET situsCity = ? WHERE county = ? AND situsZip = ? AND UPPER(situsCity) LIKE 'UNINCORP%'`,
        b.city,
        countySlug,
        zip,
      ),
    );
  }
  if (countySlug === "miami-dade") {
    // ZIPs that are entirely unincorporated (Kendall, Redland, Goulds…): USPS postal city is Miami, or Homestead in the 33030-35 ZIPs.
    changed += Number(
      await prisma.$executeRawUnsafe(
        `UPDATE "Parcel" SET situsCity = CASE WHEN situsZip IN ('33030','33033','33034','33035') THEN 'HOMESTEAD' ELSE 'MIAMI' END WHERE county = ? AND UPPER(situsCity) LIKE 'UNINCORP%'`,
        countySlug,
      ),
    );
  }
  return changed;
}
