/**
 * End-to-end smoke test (library level, real SQLite + real PDFs):
 *   sample CSV -> import -> search filters -> bulk offers -> outbox -> export batch -> mark batch sent
 * Uses a throwaway database (prisma/smoke-test.db) and a temp PDF folder, so your real
 * dev.db and public/contracts are never touched.  Run:  npm run smoke
 */
import { execSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "fs";
import os from "os";
import path from "path";
import assert from "assert/strict";

process.env.DATABASE_URL = "file:./smoke-test.db";
process.env.CONTRACTS_DIR = mkdtempSync(path.join(os.tmpdir(), "contract-sender-smoke-"));

const root = path.join(__dirname, "..");
const dbFile = path.join(root, "prisma", "smoke-test.db");

function step(msg: string) {
  console.log(`\n▶ ${msg}`);
}

async function main() {
  for (const f of [dbFile, dbFile + "-journal"]) if (existsSync(f)) unlinkSync(f);
  step("Creating throwaway SQLite DB");
  execSync("npx prisma db push --skip-generate --force-reset", {
    cwd: root,
    stdio: "pipe",
    env: process.env,
  });

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { parseCsv, toTable } = await import("../src/lib/csv");
  const { detectMapping, missingRequired } = await import("../src/lib/import-fields");
  const { runImport } = await import("../src/lib/import");
  const { parseFilters, searchListings, listingIds, listingFacets } = await import("../src/lib/listings");
  const { createBulkOffers, getSendCapStatus } = await import("../src/lib/offers");
  const { roundOffer } = await import("../src/lib/offer-utils");
  const { exportBatch, markBatchSent, markOutboxSent } = await import("../src/lib/outbox");

  try {
    // minimal seed: settings + a default template
    await prisma.settings.create({
      data: {
        id: "default",
        buyerEmail: "buyer@example.com",
        buyerPhone: "(305) 555-0100",
        dailySendCap: 5,
        duplicateGuardDays: 30,
      },
    });
    await prisma.contractTemplate.create({
      data: {
        name: "Smoke template",
        isDefault: true,
        body: "OFFER\nProperty: {{propertyAddress}}\nPrice: {{offerPrice}}\nEarnest: {{earnestMoney}}\nAgent: {{agentName}}\n",
      },
    });

    step("Import sample CSV");
    const csv = readFileSync(path.join(root, "public", "sample-mls-listings.csv"), "utf8");
    const { headers, rows } = toTable(parseCsv(csv));
    const mapping = detectMapping(headers);
    assert.equal(missingRequired(mapping).length, 0, "mapping should be complete");

    const dry = await runImport(prisma, { rows, mapping, dryRun: true });
    assert.equal(await prisma.property.count(), 0, "dry run must not write");
    assert.equal(dry.created, 12);
    assert.equal(dry.updated, 1);
    assert.equal(dry.skipped, 1);

    const sum = await runImport(prisma, { rows, mapping });
    console.log("  summary:", { ...sum, rows: undefined, skippedRows: sum.skippedRows });
    assert.equal(sum.created, 12, "12 unique properties created");
    assert.equal(sum.updated, 1, "duplicate MLS# row updates, not duplicates");
    assert.equal(sum.skipped, 1, "row without address skipped");
    assert.equal(sum.missingAgentEmail, 2);
    assert.equal(sum.dealsCreated, 12);
    assert.equal(await prisma.property.count(), 12);
    assert.equal(await prisma.deal.count({ where: { stage: "new" } }), 12);
    const updated = await prisma.property.findFirst({ where: { mlsNumber: "EX100002" } });
    assert.equal(updated?.listPrice, 439900, "re-listed row updated the price");

    step("Re-import is idempotent");
    const again = await runImport(prisma, { rows, mapping });
    assert.equal(again.created, 0);
    assert.equal(await prisma.property.count(), 12);
    assert.equal(await prisma.deal.count(), 12);
    const agentEmails = await prisma.agent.count({ where: { email: "alex.sample@example.com" } });
    assert.equal(agentEmails, 1, "agents upserted by email");

    step("Listings filters");
    const q = (s: string) => parseFilters(new URLSearchParams(s));
    const count = async (s: string) => (await searchListings(prisma, q(s), {})).total;
    assert.equal(await count(""), 12);
    assert.equal(await count("reo=1"), 2);
    assert.equal(await count("shortSale=1"), 1);
    assert.equal(await count("county=Broward"), 4);
    assert.equal(await count("maxDom=30"), 3);
    assert.equal(await count("minPrice=300000&maxPrice=450000"), 6);
    assert.equal(await count("hasAgentEmail=1"), 10);
    assert.equal(await count("q=sandbox"), 1);
    assert.equal(await count("status=Pending"), 1);
    assert.equal(await count("notOffered=1"), 12);
    const sorted = await searchListings(prisma, q(""), { sort: "listPrice", dir: "asc", pageSize: 5 });
    assert.equal(sorted.items.length, 5);
    assert.equal(sorted.pages, 3);
    assert.ok(sorted.items[0].listPrice! <= sorted.items[1].listPrice!);
    const ids = await listingIds(prisma, q("county=Broward"));
    assert.equal(ids.length, 4);

    const facets = await listingFacets(prisma);
    assert.ok(facets.statuses.includes("Pending") && facets.counties.includes("Broward"));
    assert.ok(facets.cities.length >= 8 && facets.types.length >= 1);

    step("Bulk offers (75% rule)");
    const pick = await prisma.property.findMany({ where: { id: { in: ids } }, orderBy: { address: "asc" } });
    const items = pick.map((p) => ({ propertyId: p.id, offerPrice: roundOffer(p.listPrice, 75)! }));
    const out = await createBulkOffers(prisma, { items });
    console.log("  created/skipped/errors:", out.created, out.skipped, out.errors);
    assert.equal(out.created, 4);
    assert.equal(await prisma.deal.count({ where: { stage: "offer_drafted" } }), 4);
    assert.equal(await prisma.outboxItem.count({ where: { status: "ready" } }), 4);
    const first = await prisma.outboxItem.findFirst({
      include: { deal: { include: { property: true } } },
      orderBy: { createdAt: "asc" },
    });
    assert.ok(first!.pdfPath && existsSync(path.join(process.env.CONTRACTS_DIR!, path.basename(first!.pdfPath))), "PDF file exists");
    assert.ok(readFileSync(path.join(process.env.CONTRACTS_DIR!, path.basename(first!.pdfPath!))).subarray(0, 4).toString() === "%PDF");
    assert.ok(!/\{\{/.test(first!.subject + first!.body), "no unresolved placeholders");
    assert.equal(first!.deal.offerPrice, roundOffer(first!.deal.property.listPrice, 75));
    console.log("  sample subject:", first!.subject);

    step("notOffered filter reflects drafted offers");
    assert.equal(await count("notOffered=1"), 8);

    step("Duplicate guard");
    // mark one sent, then try to re-offer it
    const target = first!;
    const r = await markOutboxSent(prisma, target.id);
    assert.ok(r.ok);
    const dup = await createBulkOffers(prisma, {
      items: [{ propertyId: target.deal.propertyId, offerPrice: 100000 }],
    });
    assert.equal(dup.skipped, 1);
    assert.match(dup.results[0].reason!, /Duplicate guard/);
    const forced = await createBulkOffers(prisma, {
      allowDuplicates: true,
      items: [{ propertyId: target.deal.propertyId, offerPrice: 100000 }],
    });
    assert.equal(forced.created, 1, "override allows re-offer");
    // also a ready (not yet sent) item for another property is guarded
    const other = await prisma.outboxItem.findFirst({ where: { status: "ready" }, include: { deal: true } });
    const dup2 = await createBulkOffers(prisma, {
      items: [{ propertyId: other!.deal.propertyId, offerPrice: 100000 }],
    });
    // same deal re-draft supersedes its own ready item (not a duplicate)
    assert.equal(dup2.created, 1);

    step("Export batch + daily cap");
    let cap = await getSendCapStatus(prisma);
    assert.equal(cap.cap, 5);
    assert.equal(cap.sentToday, 1);
    const batch = await exportBatch(prisma);
    console.log("  batch:", { count: batch.count, skippedByCap: batch.skippedByCap, skippedNoEmail: batch.skippedNoEmail });
    assert.ok(batch.count > 0 && batch.count <= cap.remaining);
    for (const it of batch.items) {
      assert.ok(it.to.includes("@") && it.subject && it.body && it.dealId && it.outboxId);
      assert.ok(path.isAbsolute(it.pdfPath) && existsSync(it.pdfPath), "batch pdfPath exists");
    }
    // exporting again without includeExported yields nothing for those items
    const second = await exportBatch(prisma);
    const firstIds = new Set(batch.items.map((i) => i.outboxId));
    assert.ok(second.items.every((i) => !firstIds.has(i.outboxId)), "no double export");
    JSON.parse(JSON.stringify(batch)); // serialisable

    step("Mark batch sent (with one failed entry)");
    const withFail = {
      ...batch,
      items: batch.items.map((it, idx) => (idx === 0 ? { ...it, status: "failed" } : it)),
    };
    const res = await markBatchSent(prisma, withFail);
    console.log("  result:", { marked: res.marked.length, failed: res.skippedFailed.length });
    assert.equal(res.skippedFailed.length, 1);
    assert.equal(res.marked.length, batch.count - 1);
    assert.equal(await prisma.deal.count({ where: { stage: "sent" } }), res.marked.length);
    const again2 = await markBatchSent(prisma, { dealIds: res.marked });
    assert.equal(again2.alreadySent.length, res.marked.length, "idempotent");
    cap = await getSendCapStatus(prisma);
    assert.equal(cap.sentToday, 1 + res.marked.length);
    // single mark-sent enforces the cap once it is reached
    await prisma.settings.update({ where: { id: "default" }, data: { dailySendCap: cap.sentToday } });
    const leftover = await prisma.outboxItem.findFirst({ where: { status: "ready" } });
    assert.ok(leftover, "one failed item is still ready");
    const blocked = await markOutboxSent(prisma, leftover!.id, { enforceCap: true });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.ok === false && blocked.reason, "cap_reached");
    const forcedMark = await markOutboxSent(prisma, leftover!.id, { enforceCap: true, force: true });
    assert.ok(forcedMark.ok, "force overrides the cap");

    step("Public-records parcels: import fixture NAL/SDF -> search -> comps -> deal");
    {
      const { Readable } = await import("stream");
      const { importCounty } = await import("../src/lib/parcels/importer");
      const { countyBySlug } = await import("../src/lib/parcels/counties");
      const { searchParcels, searchIds, exportRows, buildWhere } = await import("../src/lib/parcels/search");
      const { parcelDetail } = await import("../src/lib/parcels/detail");
      const { ensureDealForParcel } = await import("../src/lib/parcels/crm");
      const header =
        "CO_NO,PARCEL_ID,ASMNT_YR,DOR_UC,JV,AV_NSD,TV_NSD,JV_HMSTD,LND_VAL,LND_SQFOOT,ACT_YR_BLT,TOT_LVG_AREA,SALE_PRC1,SALE_YR1,SALE_MO1,QUAL_CD1,OWN_NAME,OWN_ADDR1,OWN_CITY,OWN_STATE,OWN_ZIPCD,S_LEGAL,PHY_ADDR1,PHY_CITY,PHY_ZIPCD,EXMPT_01";
      const rows: string[] = [header];
      for (let i = 1; i <= 30; i++) {
        const sqft = 1500 + i * 20;
        const absentee = i % 3 === 0;
        rows.push(
          [
            23, `00000000${String(i).padStart(5, "0")}`, 2026, i === 30 ? "011" : "001", 300000 + i * 5000, 250000, 250000, i % 2 ? 300000 : 0, 100000, 6000, 1950 + i, sqft,
            280000 + i * 3000, 2025, "06", "01", `OWNER ${i % 10} LLC`, absentee ? "PO BOX 9" : `${100 + i} NW 1 ST`, absentee ? "ATLANTA" : "MIAMI",
            absentee ? "GA" : "FL", "33100", `TESTVILLE SEC ${i % 3} PB 1-2 LOT ${i}`, `${100 + i} NW 1 ST`, "Miami", "33125", i % 2 ? 25000 : 0,
          ].join(","),
        );
      }
      const sdf = "CO_NO,PARCEL_ID,SALE_YR,SALE_MO,SALE_PRC,QUAL_CD,OR_BOOK,OR_PAGE,VI_CD\n23,0000000000001,2021,03,200000,01,100,5,I\n";
      const county = countyBySlug("miami-dade")!;
      const imp = await importCounty({ prisma, county, nal: async () => Readable.from([rows.join("\n")]), sdf: async () => Readable.from([sdf]) });
      assert.equal(imp.parcels, 30);
      assert.equal(imp.sales, 1);
      // re-import is idempotent (replaces the county)
      const imp2 = await importCounty({ prisma, county, nal: async () => Readable.from([rows.join("\n")]) });
      assert.equal(imp2.parcels, 30);
      assert.equal(await prisma.parcel.count(), 30);

      const all = await searchParcels(prisma, { criteria: [], pageSize: 50 });
      assert.equal(all.total, 30);
      const abs = await searchParcels(prisma, { criteria: [{ field: "absentee", op: "is", value: "true" }] });
      assert.equal(abs.total, 10);
      const sf = await searchParcels(prisma, {
        criteria: [
          { field: "propertyType", op: "in", value: "Single Family" },
          { field: "justValue", op: "between", value: "400000", value2: "450000" },
          { field: "ownerName", op: "contains", value: "owner 1" },
        ],
        sort: "market",
        dir: "desc",
      });
      assert.ok(sf.total > 0 && sf.items.every((r) => Number(r.justValue) >= 400000 && Number(r.justValue) <= 450000));
      assert.ok(sf.items.every((r, i, a) => i === 0 || Number(a[i - 1].justValue) >= Number(r.justValue)), "sorted desc");
      const hs = await searchParcels(prisma, { criteria: [{ field: "homestead", op: "is", value: "false" }] });
      assert.equal(hs.total, 15);
      const none = await searchParcels(prisma, { criteria: [{ field: "city", op: "contains", value: "zzz" }] });
      assert.equal(none.total, 0);
      assert.equal((await searchIds(prisma, [], 7)).length, 7);
      assert.equal((await exportRows(prisma, [{ field: "absentee", op: "is", value: "true" }], {})).length, 10);
      assert.ok(buildWhere([{ field: "reo", op: "is", value: "true" }]).where.includes("isReo"));
      await searchParcels(prisma, { criteria: [{ field: "onMls", op: "is", value: "true" }, { field: "inCrm", op: "is", value: "false" }, { field: "reo", op: "is", value: "false" }] });

      const subject = await prisma.parcel.findFirstOrThrow({ where: { parcelId: "0000000000010" } });
      await prisma.parcel.updateMany({ data: { lat: 25.77, lon: -80.2 } }); // give every fixture parcel a location
      const det = await parcelDetail(prisma, subject.id);
      assert.ok(det && det.comps.length >= 3 && det.comps.length <= 12, "comps found");
      assert.equal(det!.basis, "distance");
      assert.ok(det!.compsValueEstimate && det!.compsValueEstimate > 100000);
      assert.ok(det!.comps.every((c) => c.id !== subject.id));
      const first = await prisma.parcel.findFirstOrThrow({ where: { parcelId: "0000000000001" } });
      const d1 = await parcelDetail(prisma, first.id);
      assert.ok(d1!.sales.some((x) => x.price === 200000 && x.date === "2021-03-01"), "SDF sale in history");

      // Make offer / Add to follow-up -> CRM property + deal, idempotent
      const r1 = await ensureDealForParcel(prisma, subject);
      assert.equal(r1.created, true);
      assert.equal(r1.property.parcelId, subject.parcelId);
      assert.equal(r1.property.source, "public-records");
      assert.ok(r1.deal.offerPrice && r1.deal.offerPrice > 0);
      const r2 = await ensureDealForParcel(prisma, subject);
      assert.equal(r2.created, false);
      assert.equal(r2.deal.id, r1.deal.id);
      const inCrm = await searchParcels(prisma, { criteria: [{ field: "inCrm", op: "is", value: "true" }] });
      assert.equal(inCrm.total, 1);
      assert.equal(inCrm.items[0].dealId, r1.deal.id);
      console.log("  parcels:", { imported: imp.parcels, absentee: abs.total, comps: det!.comps.length });
    }

    console.log("\n✅ Smoke test passed");
  } finally {
    await prisma.$disconnect();
    for (const f of [dbFile, dbFile + "-journal"]) if (existsSync(f)) unlinkSync(f);
    rmSync(process.env.CONTRACTS_DIR!, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error("\n❌ Smoke test failed:", e);
  process.exit(1);
});
