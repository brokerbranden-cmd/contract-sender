/** Generate a filled FAR/BAR AS IS sample with example data: npx tsx scripts/farbar-sample.ts [out.pdf] */
import { writeFile } from "fs/promises";
import { fillFarBarAsIs } from "../src/lib/farbar/fill";

async function main() {
  const out = process.argv[2] || "farbar-sample.pdf";
  const bytes = await fillFarBarAsIs(
    {
      offerPrice: 187500,
      earnestMoney: 1000,
      closingDays: 30,
      inspectionDays: 10,
      financingType: "Cash",
      sellerName: "John Q. Sample and Mary Sample",
      property: {
        address: "1234 Palm Grove Ave",
        city: "Tampa",
        state: "FL",
        zip: "33610",
        county: "Hillsborough",
        parcelId: "A-12-29-19-4RT-000012-00034.0",
        legalDescription:
          "LOT 34, BLOCK 12, PALM GROVE ESTATES UNIT 2, ACCORDING TO THE PLAT THEREOF AS RECORDED IN PLAT BOOK 45, PAGE 67, OF THE PUBLIC RECORDS OF HILLSBOROUGH COUNTY, FLORIDA.",
      },
      agent: { name: "Jane Listing", brokerage: "Sunshine Realty Group" },
    },
    {
      buyerName: "Prop Hunters LLC",
      buyerEntity: "Prop Hunters LLC",
      buyerSignatory: "Branden Rivero",
      buyerAddress: "100 Investor Way, Suite 200",
      buyerCity: "Tampa",
      buyerState: "FL",
      buyerZip: "33602",
      defaultClosingDays: 30,
      defaultInspectionDays: 10,
      defaultEarnest: 1000,
      escrowAgentName: "Example Title & Escrow, LLC",
      escrowAgentAddress: "500 N Westshore Blvd, Tampa, FL 33609",
      escrowAgentPhone: "(813) 555-0100",
      escrowAgentEmail: "escrow@exampletitle.com",
      escrowAgentFax: "(813) 555-0101",
      depositDays: 3,
      acceptanceDays: 3,
      assignability: "assign_released",
      cooperatingSalesAssociate: "Branden Rivero",
      cooperatingBroker: "Epic Capital Realty",
      farbarAdditionalTerms:
        "1. Buyer is purchasing the Property AS IS for investment purposes.\n2. Buyer may assign this Contract without Seller consent.\n3. Seller to provide access for inspections with 24 hours notice.",
    },
    { formPath: process.env.FARBAR_ASIS_PATH, now: new Date(2026, 9, 19) }
  );
  await writeFile(out, bytes);
  console.log(`Wrote ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
