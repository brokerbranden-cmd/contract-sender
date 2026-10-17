import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { parseCsv, toTable } from "../src/lib/csv";
import { detectMapping, missingRequired, IMPORT_FIELDS } from "../src/lib/import-fields";
import { normalizeRow, parseMoney, parseBool, parseDate, parseEmail } from "../src/lib/import";
import { roundOffer, agentFirstName, buildEmailVars } from "../src/lib/offer-utils";
import { interpolate } from "../src/lib/utils";
import { extractBatchEntries } from "../src/lib/outbox";

const sample = path.join(__dirname, "..", "public", "sample-mls-listings.csv");

test("parseCsv handles quotes, embedded commas/newlines, BOM and CRLF", () => {
  const rows = parseCsv('\uFEFFa,b,c\r\n1,"x, y","line1\nline2"\r\n2,"he said ""hi""",z\r\n');
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "x, y", "line1\nline2"],
    ["2", 'he said "hi"', "z"],
  ]);
});

test("parseCsv detects tab and semicolon delimiters", () => {
  assert.deepEqual(parseCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
});

test("sample CSV auto-maps every important Matrix column", () => {
  const { headers, rows } = toTable(parseCsv(readFileSync(sample, "utf8")));
  const m = detectMapping(headers);
  assert.equal(missingRequired(m).length, 0);
  for (const key of [
    "mlsNumber", "status", "address", "city", "zip", "county", "area", "subdivision", "listPrice",
    "originalListPrice", "beds", "fullBaths", "halfBaths", "sqft", "lotSqft", "yearBuilt",
    "propertyType", "pool", "waterfront", "dom", "listDate", "shortSale", "reo", "remarks",
    "showingInstructions", "agentName", "agentEmail", "agentPhone", "officeName", "officePhone",
  ] as const) {
    assert.notEqual(m[key], undefined, `column for ${key} not detected`);
  }
  // each column used once
  const idx = Object.values(m).filter((v) => v != null);
  assert.equal(new Set(idx).size, idx.length);
  assert.equal(rows.length, 14);
});

test("generic / Reifax-style headers are detected", () => {
  const m = detectMapping([
    "MLS Number", "Property Address", "City", "Zip", "Current Price", "Bedrooms", "Bathrooms",
    "Living Area", "Year Built", "Days on Market", "Listing Agent", "Agent Email", "Agent Phone", "Brokerage",
  ]);
  assert.equal(m.mlsNumber, 0);
  assert.equal(m.address, 1);
  assert.equal(m.listPrice, 4);
  assert.equal(m.totalBaths, 6);
  assert.equal(m.sqft, 7);
  assert.equal(m.dom, 9);
  assert.equal(m.agentName, 10);
  assert.equal(m.agentEmail, 11);
  assert.equal(m.officeName, 13);
});

test("value parsers", () => {
  assert.equal(parseMoney("$1,234,500"), 1234500);
  assert.equal(parseMoney(""), null);
  assert.equal(parseBool("Y"), true);
  assert.equal(parseBool("No"), false);
  assert.equal(parseBool("None"), false);
  assert.equal(parseBool("Private"), true);
  assert.equal(parseBool(""), null);
  assert.equal(parseDate("08/04/2026")?.toISOString().slice(0, 10), "2026-08-04");
  assert.equal(parseDate("2026-08-04")?.toISOString().slice(0, 10), "2026-08-04");
  assert.equal(parseDate("46238")?.toISOString().slice(0, 10), "2026-08-04"); // Excel serial
  assert.equal(parseDate("99999999"), null);
  assert.equal(parseEmail("Name <Jo.Doe@Example.COM>; other@x.com"), "jo.doe@example.com");
});

test("normalizeRow splits combined address and sums baths", () => {
  const headers = ["Address", "Full Baths", "Half Baths", "List Price"];
  const m = detectMapping(headers);
  const n = normalizeRow(["12 Example St, Miami, FL 33101", "2", "1", "$300,000"], m);
  assert.equal(n.address, "12 Example St");
  assert.equal(n.city, "Miami");
  assert.equal(n.state, "FL");
  assert.equal(n.zip, "33101");
  assert.equal(n.baths, 2.5);
  assert.equal(n.listPrice, 300000);
});

test("roundOffer: 75% rounded to nearest $1,000", () => {
  assert.equal(roundOffer(389000, 75), 292000); // 291,750
  assert.equal(roundOffer(449900, 75), 337000); // 337,425
  assert.equal(roundOffer(300000, 75), 225000);
  assert.equal(roundOffer(null, 75), null);
  assert.equal(roundOffer(0, 75), null);
});

test("agentFirstName + email placeholders (snake and camel)", () => {
  assert.equal(agentFirstName("Smith, John A"), "John");
  assert.equal(agentFirstName("Maria Santos"), "Maria");
  assert.equal(agentFirstName(""), "");
  const vars = buildEmailVars({
    settings: { buyerName: "Prop Hunters LLC", buyerSignatory: "Branden", buyerPhone: "1", buyerEmail: "b@example.com" },
    property: { address: "1 Example St", city: "Miami", zip: "33101", mlsNumber: "EX1", listPrice: 400000 },
    agent: { name: "Maria Santos", email: "m@example.com" },
    offerPrice: 300000,
    earnestMoney: 1000,
    closingDays: 30,
  });
  const out = interpolate("Hi {{agent_first_name}} / {{agentName}}: {{offer_price}} {{offerPrice}} on {{address}} ({{mls_number}})", vars);
  assert.equal(out, "Hi Maria / Maria Santos: $300,000 $300,000 on 1 Example St, Miami (EX1)");
});

test("extractBatchEntries accepts batch file, dealIds list, and bare array", () => {
  assert.deepEqual(
    extractBatchEntries({ batchId: "b1", items: [{ dealId: "d1" }, { dealId: "d2", status: "failed" }] }).entries.map((e) => [e.dealId, e.failed]),
    [["d1", false], ["d2", true]]
  );
  assert.equal(extractBatchEntries({ dealIds: ["a", "b"] }).entries.length, 2);
  assert.equal(extractBatchEntries(["a"]).entries[0].dealId, "a");
  assert.ok(IMPORT_FIELDS.length > 30);
});
