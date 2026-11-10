import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "stream";
import { csvRecords } from "../src/lib/parcels/csv-stream";
import { mapNalRow, mapSdfRow, isAbsentee, normAddr, saleDate, subdivisionFromLegal } from "../src/lib/parcels/nal";
import { propertyTypeFromUse } from "../src/lib/parcels/dor";
import { computeEquity, computePpsf, estLoanBalance } from "../src/lib/parcels/calc";
import { countyBySlug, fdorUrl } from "../src/lib/parcels/counties";
import { buildWhere, criterionSql } from "../src/lib/parcels/search";
import { haversineMi, median } from "../src/lib/parcels/detail";
import { fmtCell, fmtDate } from "../src/lib/parcels/format";

async function collect(chunks: string[]) {
  const out: string[][] = [];
  for await (const r of csvRecords(Readable.from(chunks.map((c) => Buffer.from(c, "latin1"))))) out.push(r);
  return out;
}

test("csvRecords: quotes, embedded commas/newlines and chunk boundaries", async () => {
  const text = 'A,B,C\r\n1,"x, y","line1\nline2"\r\n2,"say ""hi""",z\r\n3,,';
  const whole = await collect([text]);
  assert.deepEqual(whole, [["A", "B", "C"], ["1", "x, y", "line1\nline2"], ["2", 'say "hi"', "z"], ["3", "", ""]]);
  // split at every byte position -> same result
  for (let i = 1; i < text.length; i++) {
    assert.deepEqual(await collect([text.slice(0, i), text.slice(i)]), whole, `split at ${i}`);
  }
});

test("propertyTypeFromUse maps DOR use codes", () => {
  assert.equal(propertyTypeFromUse("001"), "Single Family");
  assert.equal(propertyTypeFromUse("004"), "Condo");
  assert.equal(propertyTypeFromUse("000"), "Vacant Residential");
  assert.equal(propertyTypeFromUse("011"), "Commercial");
  assert.equal(propertyTypeFromUse("041"), "Industrial");
  assert.equal(propertyTypeFromUse("008"), "Townhouse/Villa (2-9 units)");
});

test("absentee detection normalises street text", () => {
  assert.equal(isAbsentee("502 SW 5 AVE", "502 SW 5TH AVENUE"), false);
  assert.equal(isAbsentee("100 S POINTE DR 1204", "100 SOUTH POINTE DRIVE"), false);
  assert.equal(isAbsentee("502 SW 5 AVE", "PO BOX 123"), true);
  assert.equal(isAbsentee("", "PO BOX 123"), false);
  assert.equal(normAddr("12 N.W. 3rd Street"), "12NW3ST");
});

test("equity + $/sqft estimates", () => {
  assert.equal(computePpsf(500000, 2000), 250);
  assert.equal(computePpsf(500000, null), null);
  const today = new Date("2026-11-01T00:00:00Z");
  // free & clear when no sale
  assert.deepEqual(computeEquity(400000, null, null, today), { estEquity: 400000, estEquityPct: 100 });
  // nominal sale ignored
  assert.equal(computeEquity(400000, 100, "2024-01-01", today).estEquity, 400000);
  // recent financed purchase leaves debt
  const eq = computeEquity(500000, 500000, "2026-01-01", today);
  assert.ok(eq.estEquity! < 150000 && eq.estEquity! > 90000, `equity ${eq.estEquity}`);
  assert.equal(estLoanBalance(500000, "1990-01-01", today), 0);
  assert.ok(estLoanBalance(500000, "2016-11-01", today) < 400000);
});

test("mapNalRow turns a NAL record into a Parcel row", () => {
  const county = countyBySlug("miami-dade")!;
  const row = mapNalRow(
    {
      PARCEL_ID: "0102030501020", DOR_UC: "001", JV: "490607", AV_NSD: "75597", TV_NSD: "25000", JV_HMSTD: "490607", LND_VAL: "450000",
      LND_SQFOOT: "5000", EFF_YR_BLT: "1923", ACT_YR_BLT: "1923", TOT_LVG_AREA: "1740", NO_RES_UNTS: "1",
      QUAL_CD1: "01", SALE_PRC1: "300000", SALE_YR1: "2025", SALE_MO1: "07", QUAL_CD2: "11", SALE_PRC2: "100", SALE_YR2: "2010", SALE_MO2: "03",
      OWN_NAME: "MARIA RODRIGUEZ", OWN_ADDR1: "PO BOX 1", OWN_CITY: "ATLANTA", OWN_STATE: "GA", OWN_ZIPCD: "30301",
      S_LEGAL: "CITY OF MIAMI SOUTH   PB B-41", PHY_ADDR1: "502 SW 5 AVE", PHY_CITY: "Miami", PHY_ZIPCD: "33130", EXMPT_01: "25000", ASMNT_YR: "2026",
    },
    county,
  )!;
  assert.equal(row.id, "23:0102030501020");
  assert.equal(row.propertyType, "Single Family");
  assert.equal(row.justValue, 490607);
  assert.equal(row.buildingValue, 40607);
  assert.equal(row.lastSaleDate, "2025-07-01");
  assert.equal(row.lastSalePrice, 300000);
  assert.equal(row.lastSaleQual, true);
  assert.equal(row.prevSalePrice, 100);
  assert.equal(row.absentee, true);
  assert.equal(row.outOfState, true);
  assert.equal(row.homestead, true);
  assert.equal(row.subdivision, "CITY OF MIAMI SOUTH");
  assert.equal(row.ppsf, Math.round((490607 / 1740) * 100) / 100);
  assert.equal(mapNalRow({}, county), null);
});

test("mapSdfRow + saleDate", () => {
  const county = countyBySlug("broward")!;
  const s = mapSdfRow({ PARCEL_ID: "494203010010", SALE_YR: "2025", SALE_MO: "13", SALE_PRC: "425000", QUAL_CD: "01", OR_BOOK: "123", OR_PAGE: "4" }, county)!;
  assert.equal(s.saleDate, "2025-01-01"); // bad month falls back to January
  assert.equal(s.qualified, true);
  assert.equal(saleDate("", "01"), null);
  assert.equal(mapSdfRow({ PARCEL_ID: "", SALE_YR: "2025" }, county), null);
  assert.equal(subdivisionFromLegal("CORAL GABLES SEC B PB 5-111 LOT 4 BLK 2"), "CORAL GABLES");
});

test("FDOR URLs", () => {
  assert.equal(
    fdorUrl(countyBySlug("miami-dade")!, "NAL"),
    "https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/Tax%20Roll%20Data%20Files/NAL/2026F/Dade%2023%20Final%20NAL%202026.zip",
  );
  assert.ok(fdorUrl(countyBySlug("palm-beach")!, "SDF").endsWith("/SDF/2026F/Palm%20Beach%2060%20Final%20SDF%202026.zip"));
  assert.equal(countyBySlug("Palm Beach")?.slug, "palm-beach");
  assert.equal(countyBySlug("nope"), undefined);
});

test("search SQL builder: operators, injection safety, stubs ignored", () => {
  const c = (field: string, op: string, value?: string, value2?: string) => criterionSql({ field, op: op as never, value, value2 });
  assert.deepEqual(c("city", "contains", "mia"), { sql: `p."situsCity" LIKE ? ESCAPE '\\'`, params: ["%mia%"] });
  assert.deepEqual(c("city", "exact", "Miami"), { sql: `p."situsCity" = ? COLLATE NOCASE`, params: ["Miami"] });
  assert.deepEqual(c("city", "multiContains", "a, b")?.params, ["%a%", "%b%"]);
  assert.equal(c("city", "contains", "   "), null);
  assert.deepEqual(c("justValue", "between", "100,000", "$300000"), { sql: `p."justValue" BETWEEN ? AND ?`, params: [100000, 300000] });
  assert.deepEqual(c("justValue", "between", "100000", ""), { sql: `p."justValue" >= ?`, params: [100000] });
  assert.deepEqual(c("yearBuilt", "multiple", "1950, 1960")?.params, [1950, 1960]);
  assert.deepEqual(c("lastSaleDate", "eq", "2024")?.params, ["2024%"]);
  assert.equal(c("lastSaleDate", "gte", "1/5/2024")?.params[0], "2024-01-05");
  assert.deepEqual(c("absentee", "is", "true"), { sql: `(p."absentee") = 1`, params: [] });
  assert.deepEqual(c("propertyType", "in", "Condo,Single Family")?.params, ["Condo", "Single Family"]);
  assert.equal(c("foreclosure", "in", "x"), null, "stub fields are ignored");
  assert.equal(c("nope", "contains", "x"), null, "unknown fields are ignored");
  // values are never interpolated into SQL
  const inj = buildWhere([{ field: "city", op: "contains", value: "x'; DROP TABLE Parcel;--" }]);
  assert.ok(!inj.where.includes("DROP"));
  assert.equal(inj.params.length, 1);
  assert.equal(buildWhere([]).where, "1=1");
});

test("comps helpers + formatting", () => {
  assert.ok(Math.abs(haversineMi(25.77, -80.19, 25.77, -80.2) - 0.62) < 0.03);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(fmtDate("2025-07-01"), "07/2025");
  assert.equal(fmtDate("2025-07-15"), "07/15/2025");
  assert.equal(fmtCell({ fmt: "money" }, 1234), "$1,234");
  assert.equal(fmtCell({ fmt: "bool" }, true), "Yes");
  assert.equal(fmtCell({ fmt: "int" }, null), "");
});
