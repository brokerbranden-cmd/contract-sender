import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import { PDFDocument } from "pdf-lib";
import {
  FARBAR_FIELD_MAP,
  buildFarBarValues,
  fillFarBarAsIs,
  resolveContractType,
  resolveFarBarPath,
  wrapToLines,
} from "../src/lib/farbar/fill";

const settings = {
  buyerName: "Prop Hunters LLC",
  buyerEntity: "Prop Hunters LLC",
  buyerAddress: "100 Main St",
  buyerCity: "Tampa",
  buyerState: "FL",
  buyerZip: "33602",
  defaultClosingDays: 30,
  defaultInspectionDays: 10,
  defaultEarnest: 1000,
  escrowAgentName: "Example Title",
  depositDays: 3,
  acceptanceDays: 3,
  assignability: "assign_released",
};
const deal = {
  offerPrice: 200000,
  earnestMoney: 2000,
  additionalDeposit: 3000,
  closingDays: 21,
  inspectionDays: 7,
  financingType: "Cash",
  property: { address: "1 Palm Ave", city: "Tampa", state: "FL", zip: "33610", county: "Hillsborough County" },
};

test("FAR/BAR field map JSON is valid", () => {
  const ids = Object.keys(FARBAR_FIELD_MAP.fields);
  assert.ok(ids.length >= 30);
  const [W, H] = FARBAR_FIELD_MAP.pageSize;
  for (const [id, f] of Object.entries(FARBAR_FIELD_MAP.fields)) {
    assert.ok(f.page >= 1 && f.page <= 13, `${id} page`);
    const boxes = f.type === "multiline" ? f.lines : [f as { x: number; y: number; maxWidth?: number }];
    if (f.type === "multiline") assert.ok(f.lines.length >= 1, `${id} lines`);
    for (const b of boxes) {
      assert.ok(b.x > 0 && b.x < W && b.y > 0 && b.y < H, `${id} coords in page`);
      if ("maxWidth" in b && b.maxWidth != null) assert.ok(b.x + b.maxWidth <= W, `${id} width`);
    }
  }
  // every value produced by the builder has a map entry
  for (const k of Object.keys(buildFarBarValues(deal, settings))) {
    assert.ok(k in FARBAR_FIELD_MAP.fields, `missing map entry for ${k}`);
  }
});

test("buildFarBarValues computes balance, dates and checkboxes", () => {
  const v = buildFarBarValues(deal, settings, new Date(2026, 9, 19));
  assert.equal(v.purchasePrice, "200,000.00");
  assert.equal(v.balanceToClose, "195,000.00");
  assert.equal(v.closingDate, "11/09/2026");
  assert.equal(v.acceptanceDeadline, "10/22/2026");
  assert.equal(v.county, "Hillsborough");
  assert.equal(v.financingCash, true);
  assert.equal(v.depositAccompaniesOffer, false);
  assert.equal(v.depositWithinDays, true);
  assert.equal(v.inspectionDays, "7");
  assert.equal(v.assignReleased, true);
  const loan = buildFarBarValues({ ...deal, financingType: "Conventional", loanAmount: 150000 }, settings);
  assert.equal(loan.balanceToClose, "45,000.00");
  assert.equal(loan.financingLoan, true);
});

test("resolveContractType honours deal > template > settings, falls back without form", () => {
  assert.equal(resolveContractType([null, "auto", "auto"], true), "farbar");
  assert.equal(resolveContractType([null, "auto", "auto"], false), "custom");
  assert.equal(resolveContractType(["custom", "farbar"], true), "custom");
  assert.equal(resolveContractType([undefined, "farbar"], false), "custom");
});

test("wrapToLines fills lines in order", () => {
  const out = wrapToLines("aa bb cc dd ee", [5, 5, 100], (t) => t.length);
  assert.deepEqual(out, ["aa bb", "cc dd", "ee"]);
});

const formPath = resolveFarBarPath(null);
test("fillFarBarAsIs fills the licensed form", { skip: !existsSync(formPath) && `form not found at ${formPath}` }, async () => {
  const bytes = await fillFarBarAsIs(deal, settings, { formPath });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 13);
});
