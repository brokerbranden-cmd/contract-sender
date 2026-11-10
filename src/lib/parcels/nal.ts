import { computeEquity, computePpsf } from "./calc";
import { propertyTypeFromUse } from "./dor";
import type { CountyInfo } from "./counties";

export type ParcelRow = {
  id: string;
  county: string;
  coNo: number;
  parcelId: string;
  situsAddress: string;
  situsCity: string;
  situsZip: string;
  ownerName: string;
  ownerAddr1: string;
  ownerAddr2: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string;
  ownerCountry: string;
  absentee: boolean;
  outOfState: boolean;
  homestead: boolean;
  useCode: string;
  propertyType: string;
  units: number | null;
  buildings: number | null;
  landValue: number | null;
  buildingValue: number | null;
  justValue: number | null;
  assessedValue: number | null;
  taxableValue: number | null;
  livingArea: number | null;
  grossArea: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  effYearBuilt: number | null;
  beds: number | null;
  baths: number | null;
  pool: boolean | null;
  stories: number | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  lastSaleQual: boolean | null;
  prevSaleDate: string | null;
  prevSalePrice: number | null;
  legal: string;
  subdivision: string;
  neighborhood: string;
  marketArea: string;
  township: string;
  range: string;
  section: string;
  censusBlock: string;
  lat: number | null;
  lon: number | null;
  ppsf: number | null;
  estEquity: number | null;
  estEquityPct: number | null;
  assessYear: number | null;
};

const n = (v: string | undefined): number | null => {
  if (v == null) return null;
  const t = v.trim();
  if (t === "") return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};
/** Number where 0 means "not present" (areas, years). */
const nz = (v: string | undefined): number | null => {
  const x = n(v);
  return x && x > 0 ? Math.round(x) : null;
};
const s = (v: string | undefined) => (v ?? "").trim();

const STREET_ABBR: [RegExp, string][] = [
  [/\bSTREET\b/g, "ST"],
  [/\bAVENUE\b/g, "AVE"],
  [/\bBOULEVARD\b/g, "BLVD"],
  [/\bDRIVE\b/g, "DR"],
  [/\bROAD\b/g, "RD"],
  [/\bLANE\b/g, "LN"],
  [/\bCOURT\b/g, "CT"],
  [/\bTERRACE\b/g, "TER"],
  [/\bPLACE\b/g, "PL"],
  [/\bCIRCLE\b/g, "CIR"],
  [/\bHIGHWAY\b/g, "HWY"],
  [/\bNORTH\b/g, "N"],
  [/\bSOUTH\b/g, "S"],
  [/\bEAST\b/g, "E"],
  [/\bWEST\b/g, "W"],
];

/** Normalise a street line for same-address comparisons. */
export function normAddr(a: string): string {
  let t = a.toUpperCase().replace(/[.,#]/g, " ");
  for (const [re, r] of STREET_ABBR) t = t.replace(re, r);
  // ordinal suffixes: 5TH -> 5
  t = t.replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1");
  return t.replace(/[^A-Z0-9]+/g, "");
}

export function isAbsentee(situs: string, ownerAddr1: string): boolean {
  const a = normAddr(situs);
  const b = normAddr(ownerAddr1);
  if (!a || !b) return false;
  return !(a.startsWith(b) || b.startsWith(a));
}

/** Short subdivision-ish name pulled from the front of the legal description. */
export function subdivisionFromLegal(legal: string): string {
  const t = legal.trim();
  if (!t) return "";
  const m = t.search(/\s{2,}|\bPB\b|\bPLAT\b|\bLOTS?\b|\bBLK\b|\bBLOCK\b|\bUNIT\b|\bSEC\b|\bTR\b|\bCOND/);
  const head = (m > 3 ? t.slice(0, m) : t).trim();
  return head.slice(0, 60);
}

export function saleDate(yr: string | undefined, mo: string | undefined): string | null {
  const y = n(yr);
  if (!y || y < 1900 || y > 2100) return null;
  let m = n(mo) ?? 1;
  if (m < 1 || m > 12) m = 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function mapNalRow(rec: Record<string, string>, county: CountyInfo, today = new Date()): ParcelRow | null {
  const parcelId = s(rec.PARCEL_ID);
  if (!parcelId) return null;
  const use = s(rec.DOR_UC).padStart(3, "0");
  const phy1 = s(rec.PHY_ADDR1);
  const own1 = s(rec.OWN_ADDR1);
  const ownState = s(rec.OWN_STATE).toUpperCase();
  const jv = n(rec.JV);
  const land = n(rec.LND_VAL);
  const s1d = saleDate(rec.SALE_YR1, rec.SALE_MO1);
  const s2d = saleDate(rec.SALE_YR2, rec.SALE_MO2);
  const s1p = n(rec.SALE_PRC1);
  const s2p = n(rec.SALE_PRC2);
  // most recent of the two sale slots
  let last = { d: s1d, p: s1p, q: s(rec.QUAL_CD1) };
  let prev = { d: s2d, p: s2p, q: s(rec.QUAL_CD2) };
  if (s2d && (!s1d || s2d > s1d)) [last, prev] = [prev, last];
  const livingArea = nz(rec.TOT_LVG_AREA);
  const homestead = (n(rec.EXMPT_01) ?? 0) > 0 || (n(rec.JV_HMSTD) ?? 0) > 0;
  const legal = s(rec.S_LEGAL);
  const eq = computeEquity(jv && jv > 0 ? jv : null, last.p, last.d, today);
  const type = propertyTypeFromUse(use);
  const zip = s(rec.PHY_ZIPCD).replace(/\.0+$/, "").slice(0, 5);

  return {
    id: `${county.coNo}:${parcelId}`,
    county: county.slug,
    coNo: county.coNo,
    parcelId,
    situsAddress: phy1,
    situsCity: s(rec.PHY_CITY),
    situsZip: zip,
    ownerName: s(rec.OWN_NAME),
    ownerAddr1: own1,
    ownerAddr2: s(rec.OWN_ADDR2),
    ownerCity: s(rec.OWN_CITY),
    ownerState: ownState,
    ownerZip: s(rec.OWN_ZIPCD).replace(/\.0+$/, "").slice(0, 10),
    ownerCountry: "",
    absentee: isAbsentee(phy1, own1),
    outOfState: ownState !== "" && ownState !== "FL",
    homestead,
    useCode: use,
    propertyType: type,
    units: nz(rec.NO_RES_UNTS),
    buildings: nz(rec.NO_BULDNG),
    landValue: land,
    buildingValue: jv != null && land != null ? Math.max(0, jv - land) : null,
    justValue: jv,
    assessedValue: n(rec.AV_NSD) ?? n(rec.AV_SD),
    taxableValue: n(rec.TV_NSD) ?? n(rec.TV_SD),
    livingArea,
    grossArea: null,
    lotSqft: nz(rec.LND_SQFOOT),
    yearBuilt: nz(rec.ACT_YR_BLT),
    effYearBuilt: nz(rec.EFF_YR_BLT),
    beds: null,
    baths: null,
    pool: null,
    stories: null,
    lastSaleDate: last.d,
    lastSalePrice: last.p,
    lastSaleQual: last.d ? last.q === "01" : null,
    prevSaleDate: prev.d,
    prevSalePrice: prev.p,
    legal,
    subdivision: subdivisionFromLegal(legal),
    neighborhood: s(rec.NBRHD_CD),
    marketArea: s(rec.MKT_AR),
    township: s(rec.TWN),
    range: s(rec.RNG),
    section: s(rec.SEC),
    censusBlock: s(rec.CENSUS_BK),
    lat: null,
    lon: null,
    ppsf: computePpsf(jv, livingArea),
    estEquity: eq.estEquity,
    estEquityPct: eq.estEquityPct,
    assessYear: n(rec.ASMNT_YR),
  };
}

export type SaleRow = {
  county: string;
  parcelId: string;
  saleDate: string;
  price: number;
  book: string;
  page: string;
  cfn: string;
  qualCode: string;
  qualified: boolean;
  vacantImp: string;
  source: string;
};

export function mapSdfRow(rec: Record<string, string>, county: CountyInfo): SaleRow | null {
  const parcelId = s(rec.PARCEL_ID);
  const d = saleDate(rec.SALE_YR, rec.SALE_MO);
  const price = n(rec.SALE_PRC);
  if (!parcelId || !d || price == null) return null;
  const q = s(rec.QUAL_CD);
  return {
    county: county.slug,
    parcelId,
    saleDate: d,
    price: Math.round(price),
    book: s(rec.OR_BOOK),
    page: s(rec.OR_PAGE),
    cfn: s(rec.CLERK_NO),
    qualCode: q,
    qualified: q === "01",
    vacantImp: s(rec.VI_CD),
    source: "SDF",
  };
}
