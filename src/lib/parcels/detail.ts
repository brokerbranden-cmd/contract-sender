import type { Parcel, PrismaClient } from "@prisma/client";
import { decorate, normalizePid } from "./search";

export type Comp = {
  id: string;
  address: string;
  city: string;
  zip: string;
  distanceMi: number | null;
  livingArea: number | null;
  beds: number | null;
  baths: number | null;
  yearBuilt: number | null;
  lotSqft: number | null;
  lastSaleDate: string;
  lastSalePrice: number;
  salePpsf: number | null;
  justValue: number | null;
  basis: "distance" | "zip";
};

export function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function twoYearsAgo(now = new Date()): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

/** Recent arm's-length sales of similar properties near the subject (from the same dataset). */
export async function findComps(db: PrismaClient, p: Parcel, opts: { limit?: number; now?: Date } = {}) {
  const limit = opts.limit ?? 12;
  const since = twoYearsAgo(opts.now);
  const sqftLo = p.livingArea ? Math.round(p.livingArea * 0.75) : null;
  const sqftHi = p.livingArea ? Math.round(p.livingArea * 1.25) : null;
  const common = {
    county: p.county,
    id: { not: p.id },
    propertyType: p.propertyType,
    lastSaleQual: true,
    lastSaleDate: { gte: since },
    lastSalePrice: { gt: 50000 },
    ...(sqftLo && sqftHi ? { livingArea: { gte: sqftLo, lte: sqftHi } } : {}),
  };
  let basis: "distance" | "zip" = "zip";
  let cands: Parcel[] = [];
  if (p.lat != null && p.lon != null) {
    const dLat = 0.02; // ~1.4 mi
    const dLon = 0.022;
    cands = await db.parcel.findMany({
      where: { ...common, lat: { gte: p.lat - dLat, lte: p.lat + dLat }, lon: { gte: p.lon - dLon, lte: p.lon + dLon } },
      take: 400,
    });
    basis = "distance";
  }
  if (cands.length < 3 && p.situsZip) {
    cands = await db.parcel.findMany({ where: { ...common, situsZip: p.situsZip }, take: 400 });
    basis = "zip";
  }
  const scored = cands.map((c) => {
    const dist = p.lat != null && p.lon != null && c.lat != null && c.lon != null ? haversineMi(p.lat, p.lon, c.lat, c.lon) : null;
    const sizeDiff = p.livingArea && c.livingArea ? Math.abs(c.livingArea - p.livingArea) / p.livingArea : 0.2;
    const yearDiff = p.yearBuilt && c.yearBuilt ? Math.min(Math.abs(c.yearBuilt - p.yearBuilt), 50) / 50 : 0.3;
    const sameSubd = p.subdivision && c.subdivision === p.subdivision ? -0.5 : 0;
    const score = (dist ?? 1) + sizeDiff * 2 + yearDiff + sameSubd;
    return { c, dist, score };
  });
  scored.sort((a, b) => a.score - b.score);
  const comps: Comp[] = scored.slice(0, limit).map(({ c, dist }) => ({
    id: c.id,
    address: c.situsAddress,
    city: c.situsCity,
    zip: c.situsZip,
    distanceMi: dist == null ? null : Math.round(dist * 100) / 100,
    livingArea: c.livingArea,
    beds: c.beds,
    baths: c.baths,
    yearBuilt: c.yearBuilt,
    lotSqft: c.lotSqft,
    lastSaleDate: c.lastSaleDate!,
    lastSalePrice: c.lastSalePrice!,
    salePpsf: c.livingArea ? Math.round(c.lastSalePrice! / c.livingArea) : null,
    justValue: c.justValue,
    basis,
  }));
  const ppsfs = comps.map((c) => c.salePpsf).filter((x): x is number => x != null);
  const medPpsf = comps.length >= 3 ? median(ppsfs) : null;
  const estValue = medPpsf && p.livingArea ? Math.round((medPpsf * p.livingArea) / 1000) * 1000 : null;
  return { comps, basis, medianSalePpsf: medPpsf, compsValueEstimate: estValue };
}

export type SaleLine = { date: string; price: number; book: string; page: string; cfn: string; qualified: boolean | null; source: string };

export async function salesHistory(db: PrismaClient, p: Parcel): Promise<SaleLine[]> {
  const rows = await db.parcelSale.findMany({ where: { county: p.county, parcelId: p.parcelId }, orderBy: { saleDate: "desc" } });
  // prefer day-precise PA GIS rows over month-level SDF rows for the same sale
  const rank = (src: string) => (src === "PA GIS" ? 0 : 1);
  const sorted = [...rows].sort((a, b) => rank(a.source) - rank(b.source));
  const seenKeys = new Set<string>();
  const dedup = sorted.filter((r) => {
    const k = `${r.saleDate.slice(0, 7)}|${r.price}`;
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });
  const out: SaleLine[] = dedup.map((r) => ({
    date: r.saleDate,
    price: r.price,
    book: r.book,
    page: r.page,
    cfn: r.cfn,
    qualified: r.qualified,
    source: r.source === "PA GIS" ? "Property Appraiser" : "FDOR sales file",
  }));
  const add = (date: string | null, price: number | null, qual: boolean | null) => {
    if (!date || price == null) return;
    if (out.some((o) => o.date.slice(0, 7) === date.slice(0, 7) && o.price === price)) return;
    out.push({ date, price, book: "", page: "", cfn: "", qualified: qual, source: "Tax roll" });
  };
  add(p.lastSaleDate, p.lastSalePrice, p.lastSaleQual);
  add(p.prevSaleDate, p.prevSalePrice, null);
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}

const PA_LINKS: Record<string, (p: Parcel) => { label: string; url: string }[]> = {
  "miami-dade": (p) => [
    { label: "Property Appraiser record", url: `https://www.miamidade.gov/Apps/PA/PropertySearch/#/?folio=${encodeURIComponent(p.parcelId)}` },
    { label: "Clerk – Official Records (mortgages, liens)", url: "https://onlineservices.miamidadeclerk.gov/officialrecords/StandardSearch.aspx" },
    { label: "Tax Collector bill", url: "https://miamidade.county-taxes.com/public" },
  ],
  broward: (p) => [
    { label: "Property Appraiser record", url: `https://web.bcpa.net/BcpaClient/#/Record/${encodeURIComponent(p.parcelId)}` },
    { label: "Records, Taxes & Treasury – Official Records", url: "https://officialrecords.broward.org/AcclaimWeb/search/Disclaimer?st=/AcclaimWeb/search/SearchTypeName" },
    { label: "Tax Collector bill", url: "https://broward.county-taxes.com/public" },
  ],
  "palm-beach": (p) => [
    { label: "Property Appraiser record", url: `https://pbcpao.gov/Property/Details?parcelId=${encodeURIComponent(p.parcelId)}` },
    { label: "Clerk – Official Records", url: "https://erec.mypalmbeachclerk.com/" },
    { label: "Tax Collector bill", url: "https://pbctax.county-taxes.com/public" },
  ],
  monroe: () => [
    { label: "Property Appraiser", url: "https://www.mcpafl.org/" },
    { label: "Tax Collector", url: "https://monroe.county-taxes.com/public" },
  ],
};

export function externalLinks(p: Parcel) {
  return (PA_LINKS[p.county] ?? (() => []))(p);
}

export async function parcelDetail(db: PrismaClient, id: string) {
  const parcel = await db.parcel.findUnique({ where: { id } });
  if (!parcel) return null;
  const [sales, compData] = await Promise.all([salesHistory(db, parcel), findComps(db, parcel)]);
  const [decorated] = await decorate(db, [{ ...parcel } as Record<string, unknown>]);
  // other parcels owned by the same owner name (same county) — handy for portfolio owners
  const sameOwner = parcel.ownerName
    ? await db.parcel.findMany({
        where: { ownerName: parcel.ownerName, id: { not: parcel.id } },
        select: { id: true, situsAddress: true, situsCity: true, propertyType: true, justValue: true },
        take: 25,
      })
    : [];
  const sameOwnerCount = parcel.ownerName ? await db.parcel.count({ where: { ownerName: parcel.ownerName } }) : 0;
  const listing = decorated.mls
    ? await db.property.findUnique({ where: { id: (decorated.mls as { id: string }).id }, include: { listAgent: true } })
    : null;
  return {
    parcel,
    sales,
    ...compData,
    mls: decorated.mls,
    dealId: decorated.dealId,
    listing,
    links: externalLinks(parcel),
    sameOwner,
    sameOwnerCount,
    pidNormalized: normalizePid(parcel.parcelId),
  };
}
