import type { Parcel, PrismaClient } from "@prisma/client";
import { roundOffer } from "../offer-utils";
import { normalizePid } from "./search";

const TYPE_MAP: Record<string, string> = {
  "Single Family": "Single Family",
  Condo: "Condo",
  "Townhouse/Villa (2-9 units)": "Townhouse",
  "Multi-Family 10+": "Multi-Family",
  "Mobile Home": "Mobile Home",
  "Vacant Residential": "Vacant Land",
};

const COUNTY_LABEL: Record<string, string> = {
  "miami-dade": "Miami-Dade",
  broward: "Broward",
  "palm-beach": "Palm Beach",
  monroe: "Monroe",
};

/** Find or create the CRM Property record for a public-records parcel (soft-linked by parcelId). */
export async function ensurePropertyForParcel(db: PrismaClient, p: Parcel) {
  const existing = await db.property.findFirst({
    where: { parcelId: p.parcelId },
  });
  if (existing) return existing;
  // an MLS-imported listing for the same address in the same ZIP: link it instead of duplicating
  const byAddr = await db.property.findFirst({
    where: { address: p.situsAddress, ...(p.situsZip ? { zip: p.situsZip } : {}) },
  });
  if (byAddr) {
    return db.property.update({
      where: { id: byAddr.id },
      data: { parcelId: byAddr.parcelId || p.parcelId, legalDescription: byAddr.legalDescription || p.legal || null },
    });
  }
  return db.property.create({
    data: {
      address: p.situsAddress || `Folio ${p.parcelId}`,
      city: p.situsCity,
      state: "FL",
      zip: p.situsZip,
      county: COUNTY_LABEL[p.county] ?? p.county,
      parcelId: p.parcelId,
      legalDescription: p.legal || null,
      sellerName: p.ownerName || null,
      beds: p.beds,
      baths: p.baths,
      sqft: p.livingArea,
      lotSqft: p.lotSqft,
      yearBuilt: p.yearBuilt,
      propertyType: TYPE_MAP[p.propertyType] ?? p.propertyType ?? "Single Family",
      subdivision: p.subdivision || null,
      status: "Off-Market",
      source: "public-records",
      notes: `Added from public records (${p.county} folio ${p.parcelId}). Owner: ${p.ownerName}. Mailing: ${[p.ownerAddr1, p.ownerCity, p.ownerState, p.ownerZip].filter(Boolean).join(", ")}. Market value ${p.justValue ?? "n/a"}.`,
    },
  });
}

export async function ensureDealForParcel(db: PrismaClient, p: Parcel, opts: { suggestOffer?: boolean } = {}) {
  const property = await ensurePropertyForParcel(db, p);
  const open = await db.deal.findFirst({ where: { propertyId: property.id }, orderBy: { createdAt: "desc" } });
  if (open) return { property, deal: open, created: false };
  const settings = await db.settings.findUnique({ where: { id: "default" } });
  const offerPrice =
    opts.suggestOffer !== false && p.justValue ? roundOffer(p.justValue, settings?.defaultOfferPct ?? 75) : null;
  const deal = await db.deal.create({
    data: {
      title: `${property.address}, ${property.city}`,
      stage: "new",
      offerPrice,
      earnestMoney: settings?.defaultEarnest ?? 1000,
      closingDays: settings?.defaultClosingDays ?? 30,
      inspectionDays: settings?.defaultInspectionDays ?? 10,
      financingType: "Cash",
      notes: `Source: public-records search. Suggested offer = ${settings?.defaultOfferPct ?? 75}% of county market value ($${p.justValue?.toLocaleString("en-US") ?? "n/a"}); change before sending.`,
      propertyId: property.id,
    },
  });
  await db.activity.create({ data: { dealId: deal.id, type: "created", message: `Deal created from public-records search (folio ${p.parcelId})` } });
  return { property, deal, created: true };
}

export { normalizePid };
