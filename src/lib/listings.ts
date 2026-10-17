import type { Prisma, PrismaClient } from "@prisma/client";

export const OFFERED_STAGES = [
  "offer_drafted",
  "sent",
  "negotiating",
  "under_contract",
  "closed",
];

export const SORTABLE = [
  "address",
  "city",
  "status",
  "listPrice",
  "beds",
  "baths",
  "sqft",
  "dom",
  "listDate",
  "updatedAt",
] as const;

export type ListingFilters = {
  q?: string;
  status?: string;
  county?: string;
  city?: string;
  zip?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  type?: string;
  maxDom?: number;
  reo?: boolean;
  shortSale?: boolean;
  hasAgentEmail?: boolean;
  notOffered?: boolean;
};

const num = (v: string | null): number | undefined => {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const flag = (v: string | null) => v === "1" || v === "true" || v === "on";

export function parseFilters(sp: URLSearchParams): ListingFilters {
  const s = (k: string) => sp.get(k)?.trim() || undefined;
  return {
    q: s("q"),
    status: s("status"),
    county: s("county"),
    city: s("city"),
    zip: s("zip"),
    minPrice: num(sp.get("minPrice")),
    maxPrice: num(sp.get("maxPrice")),
    minBeds: num(sp.get("minBeds")),
    minBaths: num(sp.get("minBaths")),
    type: s("type"),
    maxDom: num(sp.get("maxDom")),
    reo: flag(sp.get("reo")) || undefined,
    shortSale: flag(sp.get("shortSale")) || undefined,
    hasAgentEmail: flag(sp.get("hasAgentEmail")) || undefined,
    notOffered: flag(sp.get("notOffered")) || undefined,
  };
}

export function buildWhere(f: ListingFilters): Prisma.PropertyWhereInput {
  const and: Prisma.PropertyWhereInput[] = [];

  if (f.q) {
    for (const term of f.q.split(/\s+/).filter(Boolean)) {
      and.push({
        OR: [
          { address: { contains: term } },
          { city: { contains: term } },
          { mlsNumber: { contains: term } },
          { subdivision: { contains: term } },
          { zip: { contains: term } },
          { listAgent: { name: { contains: term } } },
          { listAgent: { email: { contains: term } } },
        ],
      });
    }
  }
  if (f.status) and.push({ status: f.status });
  if (f.county) and.push({ county: f.county });
  if (f.city) and.push({ city: { contains: f.city } });
  if (f.zip) and.push({ zip: { startsWith: f.zip } });
  if (f.minPrice != null) and.push({ listPrice: { gte: f.minPrice } });
  if (f.maxPrice != null) and.push({ listPrice: { lte: f.maxPrice } });
  if (f.minBeds != null) and.push({ beds: { gte: f.minBeds } });
  if (f.minBaths != null) and.push({ baths: { gte: f.minBaths } });
  if (f.type) and.push({ propertyType: f.type });
  if (f.maxDom != null) and.push({ dom: { lte: f.maxDom } });
  if (f.reo) and.push({ isReo: true });
  if (f.shortSale) and.push({ isShortSale: true });
  if (f.hasAgentEmail) {
    and.push({
      OR: [
        { listAgent: { email: { not: null }, NOT: { email: "" } } },
        { deals: { some: { agent: { email: { not: null }, NOT: { email: "" } } } } },
      ],
    });
  }
  if (f.notOffered) {
    and.push({ deals: { none: { stage: { in: OFFERED_STAGES } } } });
  }
  return and.length ? { AND: and } : {};
}

export const listingInclude = {
  listAgent: true,
  deals: {
    orderBy: { createdAt: "desc" as const },
    take: 3,
    include: {
      agent: true,
      outboxItems: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.PropertyInclude;

export type ListingRow = Prisma.PropertyGetPayload<{ include: typeof listingInclude }>;

export async function searchListings(
  prisma: PrismaClient,
  f: ListingFilters,
  opts: { sort?: string; dir?: string; page?: number; pageSize?: number }
) {
  const sort = (SORTABLE as readonly string[]).includes(opts.sort ?? "")
    ? (opts.sort as string)
    : "updatedAt";
  const dir: "asc" | "desc" = opts.dir === "asc" ? "asc" : "desc";
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 25));
  const page = Math.max(1, opts.page ?? 1);
  const where = buildWhere(f);

  const [total, items] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      orderBy: [{ [sort]: dir }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: listingInclude,
    }),
  ]);
  return { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), items };
}

export async function listingIds(prisma: PrismaClient, f: ListingFilters, max = 5000) {
  const rows = await prisma.property.findMany({
    where: buildWhere(f),
    select: { id: true },
    take: max,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => r.id);
}

/** Flatten a row for the UI. */
export function presentListing(p: ListingRow) {
  const deal = p.deals[0] ?? null;
  const agent = p.listAgent ?? deal?.agent ?? null;
  const offered = p.deals.some((d) => OFFERED_STAGES.includes(d.stage));
  return {
    id: p.id,
    mlsNumber: p.mlsNumber,
    status: p.status,
    address: p.address,
    city: p.city,
    zip: p.zip,
    county: p.county,
    subdivision: p.subdivision,
    listPrice: p.listPrice,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    yearBuilt: p.yearBuilt,
    propertyType: p.propertyType,
    dom: p.dom,
    listDate: p.listDate,
    isReo: p.isReo,
    isShortSale: p.isShortSale,
    agent: agent
      ? { id: agent.id, name: agent.name, email: agent.email, phone: agent.phone, brokerage: agent.brokerage }
      : null,
    deal: deal ? { id: deal.id, stage: deal.stage } : null,
    offered,
    outboxStatus: deal?.outboxItems[0]?.status ?? null,
  };
}

export async function listingFacets(prisma: PrismaClient) {
  const distinct = async (field: "status" | "county" | "city" | "propertyType") => {
    const rows = await prisma.property.findMany({
      distinct: [field],
      select: { [field]: true },
      orderBy: { [field]: "asc" },
    });
    return rows
      .map((r) => (r as unknown as Record<string, string | null>)[field])
      .filter((v): v is string => !!v && v.trim() !== "");
  };
  const [statuses, counties, cities, types] = await Promise.all([
    distinct("status"),
    distinct("county"),
    distinct("city"),
    distinct("propertyType"),
  ]);
  return { statuses, counties, cities, types };
}
