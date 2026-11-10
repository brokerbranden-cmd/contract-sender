/**
 * Load public-records parcels into the local database.
 *
 *   npm run data:import -- --county miami-dade
 *   npm run data:import -- --county broward
 *   npm run data:import -- --county all
 *   npm run data:import -- --county miami-dade --nal "C:\path\Dade 23 Final NAL 2026.zip" --sdf "C:\path\Dade 23 Final SDF 2026.zip"
 *
 * Source: Florida Department of Revenue tax-roll files (NAL = names/addresses/legal/values,
 * SDF = sales). Free and public, no login:
 * https://floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx
 *
 * Re-running replaces that county's parcels; deals, listings, agents etc. are untouched.
 * Options: --year 2026  --stage Final|Preliminary  --refresh (re-download)  --no-sales
 *          --limit N (testing)  --cache-dir data/tax-roll  --enrich (also fetch beds/baths/lat/lon, see data:enrich)
 */
import path from "path";
import { bulkClient, importCounty } from "../src/lib/parcels/importer";
import { COUNTIES, countyBySlug, fdorUrl, type CountyInfo } from "../src/lib/parcels/counties";
import { downloadFile, openRollFile } from "../src/lib/parcels/source";
import { enrichCounty } from "../src/lib/parcels/enrich";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}
const log = (m: string) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);

async function main() {
  const countyArg = arg("county");
  if (!countyArg) {
    console.error(`Usage: npm run data:import -- --county <${COUNTIES.map((c) => c.slug).join("|")}|all> [--nal file] [--sdf file]`);
    process.exit(1);
  }
  const targets: CountyInfo[] =
    countyArg === "all"
      ? COUNTIES
      : (() => {
          const c = countyBySlug(countyArg);
          if (!c) {
            console.error(`Unknown county "${countyArg}". Choose: ${COUNTIES.map((x) => x.slug).join(", ")}, all`);
            process.exit(1);
          }
          return [c];
        })();
  const year = Number(arg("year") ?? 2026);
  const stage = (arg("stage") ?? "Final") as "Final" | "Preliminary";
  const cacheDir = path.resolve(arg("cache-dir") ?? path.join(process.cwd(), "data", "tax-roll"));
  const refresh = arg("refresh") === "true";
  const limit = arg("limit") ? Number(arg("limit")) : undefined;
  const prisma = bulkClient();

  try {
    for (const county of targets) {
      log(`=== ${county.name} (FDOR county ${county.coNo}) ===`);
      let nalPath = arg("nal");
      let sdfPath = arg("sdf");
      if (!nalPath) {
        nalPath = await downloadFile(fdorUrl(county, "NAL", year, stage), path.join(cacheDir, `${county.slug}-NAL-${year}${stage[0]}.zip`), { refresh, log });
      }
      if (!sdfPath && arg("no-sales") !== "true") {
        try {
          sdfPath = await downloadFile(fdorUrl(county, "SDF", year, stage), path.join(cacheDir, `${county.slug}-SDF-${year}${stage[0]}.zip`), { refresh, log });
        } catch (e) {
          log(`Sales file unavailable (${(e as Error).message}); continuing without it.`);
        }
      }
      const res = await importCounty({
        prisma,
        county,
        nal: () => openRollFile(nalPath!),
        sdf: sdfPath && arg("no-sales") !== "true" ? () => openRollFile(sdfPath!) : undefined,
        limit,
        keepIndexes: arg("keep-indexes") === "true",
        log,
      });
      log(`${county.name}: ${res.parcels.toLocaleString()} parcels, ${res.sales.toLocaleString()} sales rows in ${res.seconds}s (${res.skipped} skipped)`);
      if (arg("enrich") === "true") await enrichCounty({ prisma, county, log });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
