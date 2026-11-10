/**
 * Field catalogue for the Reifax-style parcel search. Client-safe (plain data):
 * the filter panel, the results columns and the SQL builder all read from here.
 * `sql` fragments reference the Parcel table through the alias `p`.
 */
import { PROPERTY_TYPES } from "./dor";
import { COUNTIES } from "./counties";

export type FieldType = "text" | "number" | "money" | "date" | "bool" | "enum";

export type FieldDef = {
  key: string;
  label: string;
  group: string;
  type: FieldType;
  sql: string;
  options?: { value: string; label: string }[];
  /** Not backed by free bulk data yet: shown disabled in the panel. */
  stub?: boolean;
  note?: string;
  hint?: string;
};

export const FILTER_GROUPS = [
  "Location",
  "Property",
  "Owner",
  "Values",
  "Sales",
  "MLS / CRM",
  "Foreclosure",
  "Tax Delinquent",
  "Probate",
] as const;

const YEARS_OWNED = `(CASE WHEN p."lastSaleDate" IS NULL THEN NULL ELSE (julianday('now') - julianday(p."lastSaleDate")) / 365.25 END)`;
const NORM_PID = `REPLACE(REPLACE(REPLACE(pr."parcelId",'-',''),' ',''),'.','')`;

export const FIELDS: FieldDef[] = [
  // ---- Location
  {
    key: "county",
    label: "County",
    group: "Location",
    type: "enum",
    sql: `p."county"`,
    options: COUNTIES.map((c) => ({ value: c.slug, label: c.name })),
  },
  { key: "address", label: "Full Address", group: "Location", type: "text", sql: `p."situsAddress"` },
  { key: "city", label: "City", group: "Location", type: "text", sql: `p."situsCity"` },
  { key: "zip", label: "ZIP Code", group: "Location", type: "text", sql: `p."situsZip"` },
  { key: "subdivision", label: "Subd Name", group: "Location", type: "text", sql: `p."subdivision"`, hint: "Taken from the front of the legal description" },
  { key: "legal", label: "Legal D.", group: "Location", type: "text", sql: `p."legal"` },
  { key: "folio", label: "Folio # / Parcel ID", group: "Location", type: "text", sql: `p."parcelId"` },
  { key: "township", label: "TWN", group: "Location", type: "text", sql: `p."township"` },
  { key: "range", label: "RNG", group: "Location", type: "text", sql: `p."range"` },
  { key: "section", label: "SECT", group: "Location", type: "text", sql: `p."section"` },
  // ---- Property
  {
    key: "propertyType",
    label: "Property Type",
    group: "Property",
    type: "enum",
    sql: `p."propertyType"`,
    options: PROPERTY_TYPES.map((t) => ({ value: t, label: t })),
  },
  { key: "useCode", label: "DOR Use Code", group: "Property", type: "text", sql: `p."useCode"` },
  { key: "beds", label: "Beds", group: "Property", type: "number", sql: `p."beds"`, note: "Miami-Dade only (run data:enrich)" },
  { key: "baths", label: "Baths", group: "Property", type: "number", sql: `p."baths"`, note: "Miami-Dade only (run data:enrich)" },
  { key: "livingArea", label: "LArea (living sqft)", group: "Property", type: "number", sql: `p."livingArea"` },
  { key: "grossArea", label: "GArea (gross sqft)", group: "Property", type: "number", sql: `p."grossArea"`, note: "Miami-Dade only" },
  { key: "lotSqft", label: "Lot Size (sqft)", group: "Property", type: "number", sql: `p."lotSqft"` },
  { key: "yearBuilt", label: "Built", group: "Property", type: "number", sql: `p."yearBuilt"` },
  { key: "units", label: "Units", group: "Property", type: "number", sql: `p."units"` },
  { key: "stories", label: "Stories", group: "Property", type: "number", sql: `p."stories"`, note: "Miami-Dade only" },
  { key: "pool", label: "Pool", group: "Property", type: "bool", sql: `p."pool"`, stub: true, note: "Not in the free tax roll" },
  // ---- Owner
  { key: "ownerName", label: "Owner Name", group: "Owner", type: "text", sql: `p."ownerName"` },
  { key: "absentee", label: "Absentee Owner", group: "Owner", type: "bool", sql: `p."absentee"`, hint: "Mailing address differs from the property address" },
  { key: "outOfState", label: "Out-of-State Owner", group: "Owner", type: "bool", sql: `p."outOfState"` },
  { key: "ownerAddr", label: "Owner Address", group: "Owner", type: "text", sql: `p."ownerAddr1"` },
  { key: "ownerCity", label: "Owner City", group: "Owner", type: "text", sql: `p."ownerCity"` },
  { key: "ownerState", label: "Owner State", group: "Owner", type: "text", sql: `p."ownerState"` },
  { key: "ownerZip", label: "Owner ZIP", group: "Owner", type: "text", sql: `p."ownerZip"` },
  { key: "ownerPhone", label: "Phone Number", group: "Owner", type: "text", sql: `''`, stub: true, note: "Needs skip tracing (paid)" },
  // ---- Values
  { key: "landValue", label: "Land Value", group: "Values", type: "money", sql: `p."landValue"` },
  { key: "buildingValue", label: "Build Value", group: "Values", type: "money", sql: `p."buildingValue"` },
  { key: "justValue", label: "Market (Just) Value", group: "Values", type: "money", sql: `p."justValue"` },
  { key: "assessedValue", label: "Assessed Value", group: "Values", type: "money", sql: `p."assessedValue"` },
  { key: "taxableValue", label: "Tax (Taxable) Value", group: "Values", type: "money", sql: `p."taxableValue"` },
  { key: "homestead", label: "Homestead", group: "Values", type: "bool", sql: `p."homestead"` },
  { key: "ppsf", label: "$/Sqft", group: "Values", type: "money", sql: `p."ppsf"`, hint: "Just value ÷ living area" },
  {
    key: "estEquity",
    label: "Est. Equity ($)",
    group: "Values",
    type: "money",
    sql: `p."estEquity"`,
    hint: "Rough estimate: just value minus an assumed 80% LTV, 30-yr 6.5% loan from the last known sale (free & clear if none known, so treat as an upper bound)",
  },
  { key: "estEquityPct", label: "Est. Equity (%)", group: "Values", type: "number", sql: `p."estEquityPct"` },
  { key: "knownDebt", label: "Known Debt", group: "Values", type: "money", sql: `NULL`, stub: true, note: "Mortgage data is not free in bulk" },
  // ---- Sales
  { key: "lastSaleDate", label: "Last Sale (date)", group: "Sales", type: "date", sql: `p."lastSaleDate"` },
  { key: "lastSalePrice", label: "Sold Price", group: "Sales", type: "money", sql: `p."lastSalePrice"` },
  { key: "lastSaleQual", label: "Last sale qualified (arm's-length)", group: "Sales", type: "bool", sql: `p."lastSaleQual"` },
  {
    key: "yearsOwned",
    label: "Years since last sale",
    group: "Sales",
    type: "number",
    sql: YEARS_OWNED,
    hint: "Miami-Dade has full history; Broward/Palm Beach/Monroe only know sales since 2025",
  },
  { key: "prevSaleDate", label: "Prior Sale (date)", group: "Sales", type: "date", sql: `p."prevSaleDate"` },
  { key: "prevSalePrice", label: "Prior Sale Price", group: "Sales", type: "money", sql: `p."prevSalePrice"` },
  // ---- MLS / CRM (wired to existing data)
  {
    key: "onMls",
    label: "Imported on MLS (Listings)",
    group: "MLS / CRM",
    type: "bool",
    sql: `(p."parcelId" IN (SELECT ${NORM_PID} FROM "Property" pr WHERE pr."parcelId" IS NOT NULL AND pr."parcelId" <> '') OR UPPER(p."situsAddress") IN (SELECT UPPER(pr."address") FROM "Property" pr WHERE pr."source" IS NOT NULL AND pr."source" <> 'public-records' AND pr."mlsNumber" IS NOT NULL))`,
  },
  {
    key: "inCrm",
    label: "Already in Deals (Follow Up)",
    group: "MLS / CRM",
    type: "bool",
    sql: `(p."parcelId" IN (SELECT ${NORM_PID} FROM "Property" pr JOIN "Deal" d ON d."propertyId" = pr."id" WHERE pr."parcelId" IS NOT NULL AND pr."parcelId" <> ''))`,
  },
  // ---- Foreclosure / Tax delinquent / Probate (stubs: no free bulk source wired)
  {
    key: "reo",
    label: "REO / Bank-owned (from imported MLS)",
    group: "Foreclosure",
    type: "bool",
    sql: `(p."parcelId" IN (SELECT ${NORM_PID} FROM "Property" pr WHERE pr."isReo" = 1 AND pr."parcelId" IS NOT NULL))`,
  },
  {
    key: "shortSale",
    label: "Short sale (from imported MLS)",
    group: "Foreclosure",
    type: "bool",
    sql: `(p."parcelId" IN (SELECT ${NORM_PID} FROM "Property" pr WHERE pr."isShortSale" = 1 AND pr."parcelId" IS NOT NULL))`,
  },
  { key: "foreclosure", label: "Foreclosure status", group: "Foreclosure", type: "enum", sql: `NULL`, stub: true, note: "Needs county clerk lis pendens data" },
  { key: "foreclosureFiled", label: "File Date", group: "Foreclosure", type: "date", sql: `NULL`, stub: true, note: "Needs county clerk lis pendens data" },
  { key: "taxYear", label: "Tax Year", group: "Tax Delinquent", type: "number", sql: `NULL`, stub: true, note: "Needs tax collector delinquency data" },
  { key: "taxOwed", label: "Tax Amount Owed", group: "Tax Delinquent", type: "money", sql: `NULL`, stub: true, note: "Needs tax collector delinquency data" },
  { key: "probate", label: "Probate", group: "Probate", type: "bool", sql: `NULL`, stub: true, note: "Needs clerk probate filings" },
  { key: "deceased", label: "Deceased owner", group: "Probate", type: "bool", sql: `NULL`, stub: true, note: "Needs obituary / probate matching" },
];

export const FIELD_MAP: Record<string, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

export type Op =
  | "exact"
  | "notExact"
  | "contains"
  | "notContains"
  | "multiContains"
  | "multiNotContains"
  | "startsWith"
  | "eq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "multiple"
  | "in"
  | "notIn"
  | "is"
  | "empty"
  | "notEmpty";

export const OPS_BY_TYPE: Record<FieldType, { op: Op; label: string }[]> = {
  text: [
    { op: "contains", label: "Contains" },
    { op: "exact", label: "Exact" },
    { op: "notExact", label: "Not Exact" },
    { op: "notContains", label: "Not Contains" },
    { op: "startsWith", label: "Starts With" },
    { op: "multiContains", label: "Multiple Contains (a, b)" },
    { op: "multiNotContains", label: "Multiple Not Contains" },
    { op: "empty", label: "Empty" },
    { op: "notEmpty", label: "Not Empty" },
  ],
  number: numOps(),
  money: numOps(),
  date: numOps(),
  bool: [{ op: "is", label: "Is" }],
  enum: [
    { op: "in", label: "Is any of" },
    { op: "notIn", label: "Is none of" },
    { op: "empty", label: "Empty" },
    { op: "notEmpty", label: "Not Empty" },
  ],
};

function numOps(): { op: Op; label: string }[] {
  return [
    { op: "between", label: "Between" },
    { op: "eq", label: "Equal" },
    { op: "gte", label: "Equal or Greater" },
    { op: "lte", label: "Equal or Less" },
    { op: "gt", label: "Greater Than" },
    { op: "lt", label: "Less Than" },
    { op: "multiple", label: "Multiple (a, b)" },
    { op: "empty", label: "Empty" },
    { op: "notEmpty", label: "Not Empty" },
  ];
}

export type Criterion = { field: string; op: Op; value?: string; value2?: string };

// ---------------------------------------------------------------- columns

export type ColFmt = "text" | "money" | "int" | "num" | "bool" | "date" | "pct" | "ppsf";
export type ColumnDef = {
  key: string;
  label: string;
  fmt: ColFmt;
  /** Parcel field (property name on the row). */
  prop: string;
  /** SQL used for sorting. */
  sort: string;
  align?: "right";
};

export const COLUMNS: ColumnDef[] = [
  { key: "address", label: "Address", fmt: "text", prop: "situsAddress", sort: `p."situsAddress"` },
  { key: "city", label: "City", fmt: "text", prop: "situsCity", sort: `p."situsCity"` },
  { key: "zip", label: "Zip", fmt: "text", prop: "situsZip", sort: `p."situsZip"` },
  { key: "county", label: "County", fmt: "text", prop: "county", sort: `p."county"` },
  { key: "type", label: "Type", fmt: "text", prop: "propertyType", sort: `p."propertyType"` },
  { key: "larea", label: "LArea", fmt: "int", prop: "livingArea", sort: `p."livingArea"`, align: "right" },
  { key: "garea", label: "GArea", fmt: "int", prop: "grossArea", sort: `p."grossArea"`, align: "right" },
  { key: "lot", label: "Lot", fmt: "int", prop: "lotSqft", sort: `p."lotSqft"`, align: "right" },
  { key: "beds", label: "Beds", fmt: "int", prop: "beds", sort: `p."beds"`, align: "right" },
  { key: "baths", label: "Baths", fmt: "num", prop: "baths", sort: `p."baths"`, align: "right" },
  { key: "pool", label: "Pool", fmt: "bool", prop: "pool", sort: `p."pool"` },
  { key: "built", label: "Built", fmt: "int", prop: "yearBuilt", sort: `p."yearBuilt"`, align: "right" },
  { key: "soldPrice", label: "Sold Price", fmt: "money", prop: "lastSalePrice", sort: `p."lastSalePrice"`, align: "right" },
  { key: "soldDate", label: "Last Sale", fmt: "date", prop: "lastSaleDate", sort: `p."lastSaleDate"` },
  { key: "taxValue", label: "Tax Value", fmt: "money", prop: "taxableValue", sort: `p."taxableValue"`, align: "right" },
  { key: "landValue", label: "Land Value", fmt: "money", prop: "landValue", sort: `p."landValue"`, align: "right" },
  { key: "buildValue", label: "Build Value", fmt: "money", prop: "buildingValue", sort: `p."buildingValue"`, align: "right" },
  { key: "market", label: "Market", fmt: "money", prop: "justValue", sort: `p."justValue"`, align: "right" },
  { key: "assessed", label: "Assessed", fmt: "money", prop: "assessedValue", sort: `p."assessedValue"`, align: "right" },
  { key: "ppsf", label: "$/Sqft", fmt: "ppsf", prop: "ppsf", sort: `p."ppsf"`, align: "right" },
  { key: "equity", label: "Est. Equity", fmt: "money", prop: "estEquity", sort: `p."estEquity"`, align: "right" },
  { key: "equityPct", label: "Eq %", fmt: "pct", prop: "estEquityPct", sort: `p."estEquityPct"`, align: "right" },
  { key: "owner", label: "Owner", fmt: "text", prop: "ownerName", sort: `p."ownerName"` },
  { key: "ownerAddr", label: "Owner Mailing", fmt: "text", prop: "ownerMailing", sort: `p."ownerAddr1"` },
  { key: "absentee", label: "Absentee", fmt: "bool", prop: "absentee", sort: `p."absentee"` },
  { key: "homestead", label: "Homestead", fmt: "bool", prop: "homestead", sort: `p."homestead"` },
  { key: "yearsOwned", label: "Yrs Owned", fmt: "num", prop: "yearsOwned", sort: YEARS_OWNED, align: "right" },
  { key: "folio", label: "Folio", fmt: "text", prop: "parcelId", sort: `p."parcelId"` },
];
export const COLUMN_MAP: Record<string, ColumnDef> = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));

export const DEFAULT_COLUMNS = [
  "address",
  "city",
  "zip",
  "larea",
  "beds",
  "baths",
  "pool",
  "built",
  "soldPrice",
  "taxValue",
  "landValue",
  "buildValue",
  "market",
  "owner",
  "absentee",
];
