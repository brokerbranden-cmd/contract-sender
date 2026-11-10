/**
 * Optional enrichment of loaded parcels with fields the FDOR roll does not carry:
 *   Miami-Dade : beds, baths, gross area, floors, lat/long   (Property Appraiser GIS "PaGis" layer, public)
 *   Broward    : lat/long                                      (BCPA parcel-boundary service, public centroids)
 *   Palm Beach, Monroe : lat/long                              (Florida Statewide Cadastral, public centroids)
 * All free, no key. Run with `npm run data:enrich -- --county miami-dade`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import type { CountyInfo } from "./counties";
import { computeEquity } from "./calc";

type Log = (m: string) => void;
type PaSale = { date: string; price: number; qualified: boolean; book: string; page: string };
type Enriched = {
  parcelId: string;
  lat: number | null;
  lon: number | null;
  beds?: number | null;
  baths?: number | null;
  grossArea?: number | null;
  stories?: number | null;
  // Miami-Dade PA GIS extras
  city?: string | null;
  zip?: string | null;
  address?: string | null;
  sales?: PaSale[];
};

const UA = { "User-Agent": "contract-sender/1.0 (public records research)" };

async function arcgis(url: string, params: Record<string, string>, tries = 6): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ f: "json", ...params }),
      });
      const j: any = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200));
      return j;
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
    }
  }
  throw lastErr;
}

const PAGIS = "https://gisweb.miamidade.gov/arcgis/rest/services/MD_ComparableSales/MapServer/5/query";
const BCPA = "https://services5.arcgis.com/wI5GZmCtnUU8ueya/ArcGIS/rest/services/Broward_County_Parcel_Boundary/FeatureServer/1/query";
const STATEWIDE = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query";

const r6 = (x: number | undefined | null) => (typeof x === "number" && Number.isFinite(x) && x !== 0 ? Math.round(x * 1e6) / 1e6 : null);

async function* pagis(log: Log): AsyncGenerator<Enriched[]> {
  const STEP = 5000;
  const stat = await arcgis(PAGIS, { where: "1=1", outStatistics: JSON.stringify([{ statisticType: "max", onStatisticField: "OBJECTID", outStatisticFieldName: "mx" }]) });
  const max = stat.features[0].attributes.mx as number;
  const starts: number[] = [];
  for (let s = 0; s < max; s += STEP) starts.push(s);
  log(`PaGis: ${starts.length} pages`);
  const CONC = 4;
  for (let i = 0; i < starts.length; i += CONC) {
    const pages = await Promise.all(
      starts.slice(i, i + CONC).map((s) =>
        arcgis(PAGIS, {
          where: `OBJECTID>${s} AND OBJECTID<=${s + STEP}`,
          outFields:
            "FOLIO,TRUE_SITE_ADDR,TRUE_SITE_CITY,TRUE_SITE_ZIP_CODE,BEDROOM_COUNT,BATHROOM_COUNT,HALF_BATHROOM_COUNT,FLOOR_COUNT,BUILDING_ACTUAL_AREA,DOS_1,PRICE_1,QU_FLG_1,OR_BK_1,OR_PG_1,DOS_2,PRICE_2,QU_FLG_2,DOS_3,PRICE_3,QU_FLG_3",
          returnGeometry: "true",
          outSR: "4326",
          geometryPrecision: "6",
        }),
      ),
    );
    const out: Enriched[] = [];
    for (const p of pages)
      for (const f of p.features ?? []) {
        const a = f.attributes;
        if (!a.FOLIO) continue;
        const beds = a.BEDROOM_COUNT > 0 && a.BEDROOM_COUNT <= 20 ? Math.round(a.BEDROOM_COUNT) : null;
        const bathsRaw = (a.BATHROOM_COUNT ?? 0) + 0.5 * (a.HALF_BATHROOM_COUNT ?? 0);
        const sales: PaSale[] = [];
        for (const i of [1, 2, 3]) {
          const dos = String(a[`DOS_${i}`] ?? "");
          const price = Number(a[`PRICE_${i}`] ?? 0);
          if (/^\d{8}$/.test(dos) && price > 0)
            sales.push({
              date: `${dos.slice(0, 4)}-${dos.slice(4, 6)}-${dos.slice(6, 8)}`,
              price: Math.round(price),
              qualified: a[`QU_FLG_${i}`] === "Q",
              book: i === 1 ? String(a.OR_BK_1 ?? "").trim() : "",
              page: i === 1 ? String(a.OR_PG_1 ?? "").trim() : "",
            });
        }
        const city = String(a.TRUE_SITE_CITY ?? "").trim();
        out.push({
          city: city || null,
          zip: String(a.TRUE_SITE_ZIP_CODE ?? "").slice(0, 5) || null,
          address: String(a.TRUE_SITE_ADDR ?? "").trim() || null,
          sales,
          parcelId: String(a.FOLIO).trim(),
          lat: r6(f.geometry?.y),
          lon: r6(f.geometry?.x),
          beds,
          baths: bathsRaw > 0 && bathsRaw <= 20 ? bathsRaw : null,
          grossArea: a.BUILDING_ACTUAL_AREA > 0 ? Math.round(a.BUILDING_ACTUAL_AREA) : null,
          stories: a.FLOOR_COUNT > 0 && a.FLOOR_COUNT <= 10 ? Math.round(a.FLOOR_COUNT) : null,
        });
      }
    yield out;
  }
}

async function* centroids(url: string, idField: string, where: string, extraWhere: string, log: Log): AsyncGenerator<Enriched[]> {
  const ids: number[] = (await arcgis(url, { where, returnIdsOnly: "true" })).objectIds ?? [];
  ids.sort((a, b) => a - b);
  log(`${ids.length.toLocaleString()} parcel shapes to read`);
  const PAGE = 2000;
  const CONC = 4;
  const chunks: number[][] = [];
  for (let k = 0; k < ids.length; k += PAGE) chunks.push(ids.slice(k, k + PAGE));
  for (let i = 0; i < chunks.length; i += CONC) {
    const pages = await Promise.all(
      chunks.slice(i, i + CONC).map((c) =>
        arcgis(url, {
          where: `OBJECTID>=${c[0]} AND OBJECTID<=${c[c.length - 1]}${extraWhere}`,
          outFields: idField,
          returnGeometry: "false",
          returnCentroid: "true",
          outSR: "4326",
        }),
      ),
    );
    const out: Enriched[] = [];
    for (const p of pages)
      for (const f of p.features ?? []) {
        const id = f.attributes?.[idField];
        if (!id) continue;
        out.push({ parcelId: String(id).trim(), lat: r6(f.centroid?.y), lon: r6(f.centroid?.x) });
      }
    yield out;
  }
}

export async function enrichCounty(opts: { prisma: PrismaClient; county: CountyInfo; log?: Log }): Promise<{ updated: number }> {
  const { prisma, county } = opts;
  const log = opts.log ?? (() => {});
  const gen =
    county.slug === "miami-dade"
      ? pagis(log)
      : county.slug === "broward"
        ? centroids(BCPA, "PARCELNO", "1=1", "", log)
        : centroids(STATEWIDE, "PARCEL_ID", `CO_NO=${county.coNo}`, ` AND CO_NO=${county.coNo}`, log);

  await prisma.$queryRawUnsafe("PRAGMA synchronous=OFF");
  let updated = 0;
  let seen = 0;
  let salesChanged = false;
  let lastLogged = 0;
  const hasSales = county.slug === "miami-dade";
  if (hasSales) await prisma.$executeRawUnsafe(`DELETE FROM "ParcelSale" WHERE county = ? AND source = 'PA GIS'`, county.slug);
  for await (const rows of gen) {
    seen += rows.length;
    const stmts = rows.map((r) => {
      const real = (r.sales ?? []).sort((a, b) => b.date.localeCompare(a.date));
      const last = real[0];
      const prev = real[1];
      if (last) salesChanged = true;
      return prisma.$executeRawUnsafe(
        `UPDATE "Parcel" SET lat = ?, lon = ?, beds = COALESCE(?, beds), baths = COALESCE(?, baths), grossArea = COALESCE(?, grossArea), stories = COALESCE(?, stories),
           situsZip = COALESCE(NULLIF(situsZip, ''), ?, situsZip), situsAddress = COALESCE(NULLIF(situsAddress, ''), ?, situsAddress),
           lastSaleDate = COALESCE(?, lastSaleDate), lastSalePrice = COALESCE(?, lastSalePrice), lastSaleQual = COALESCE(?, lastSaleQual),
           prevSaleDate = COALESCE(?, prevSaleDate), prevSalePrice = COALESCE(?, prevSalePrice)
         WHERE county = ? AND parcelId = ?`,
        r.lat,
        r.lon,
        r.beds ?? null,
        r.baths ?? null,
        r.grossArea ?? null,
        r.stories ?? null,
        r.zip ?? null,
        r.address ?? null,
        last?.date ?? null,
        last?.price ?? null,
        last ? (last.qualified ? 1 : 0) : null,
        prev?.date ?? null,
        prev?.price ?? null,
        county.slug,
        r.parcelId,
      );
    });
    for (let i = 0; i < stmts.length; i += 2500) {
      const res = await prisma.$transaction(stmts.slice(i, i + 2500));
      updated += res.reduce((a, b) => a + (b as number), 0);
    }
    if (hasSales) {
      const saleRows = rows.flatMap((r) =>
        (r.sales ?? []).map((x) => ({ county: county.slug, parcelId: r.parcelId, saleDate: x.date, price: x.price, book: x.book, page: x.page, cfn: "", qualCode: x.qualified ? "Q" : "U", qualified: x.qualified, vacantImp: "", source: "PA GIS" })),
      );
      for (let i = 0; i < saleRows.length; i += 1000) await prisma.parcelSale.createMany({ data: saleRows.slice(i, i + 1000) });
    }
    if (seen - lastLogged >= 50000) {
      lastLogged = seen;
      log(`  enriched ${updated.toLocaleString()} parcels (${seen.toLocaleString()} source rows)`);
    }
  }
  log(`${county.name}: enrichment matched ${updated.toLocaleString()} parcels`);
  if (salesChanged) await recomputeEquity(prisma, county, log);
  return { updated };
}

/** Re-derive est. equity for a county after sale history changed. */
export async function recomputeEquity(prisma: PrismaClient, county: CountyInfo, log: Log = () => {}) {
  const today = new Date();
  let after = "";
  let n = 0;
  for (;;) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id, justValue, lastSalePrice, lastSaleDate FROM "Parcel" WHERE county = ? AND id > ? ORDER BY id LIMIT 5000`,
      county.slug,
      after,
    )) as { id: string; justValue: number | null; lastSalePrice: number | null; lastSaleDate: string | null }[];
    if (!rows.length) break;
    await prisma.$transaction(
      rows.map((r) => {
        const e = computeEquity(r.justValue, r.lastSalePrice, r.lastSaleDate, today);
        return prisma.$executeRawUnsafe(`UPDATE "Parcel" SET estEquity = ?, estEquityPct = ? WHERE id = ?`, e.estEquity, e.estEquityPct, r.id);
      }),
    );
    after = rows[rows.length - 1].id;
    n += rows.length;
    if (n % 100000 < 5000) log(`  equity recomputed for ${n.toLocaleString()} parcels`);
  }
  log(`${county.name}: equity estimates recomputed (${n.toLocaleString()})`);
}
