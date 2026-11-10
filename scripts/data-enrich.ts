/**
 * Add lat/long (all counties) and beds/baths/gross area (Miami-Dade) to already-imported parcels
 * from free public GIS services.   npm run data:enrich -- --county miami-dade
 */
import { bulkClient } from "../src/lib/parcels/importer";
import { COUNTIES, countyBySlug } from "../src/lib/parcels/counties";
import { enrichCounty } from "../src/lib/parcels/enrich";

const i = process.argv.indexOf("--county");
const v = i === -1 ? undefined : process.argv[i + 1];
const log = (m: string) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);

async function main() {
  if (!v) {
    console.error(`Usage: npm run data:enrich -- --county <${COUNTIES.map((c) => c.slug).join("|")}|all>`);
    process.exit(1);
  }
  const targets = v === "all" ? COUNTIES : [countyBySlug(v)].filter(Boolean) as typeof COUNTIES;
  if (!targets.length) {
    console.error(`Unknown county "${v}"`);
    process.exit(1);
  }
  const prisma = bulkClient();
  try {
    for (const c of targets) {
      log(`=== enrich ${c.name} ===`);
      await enrichCounty({ prisma, county: c, log });
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
