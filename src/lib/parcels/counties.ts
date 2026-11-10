/**
 * Counties supported by `npm run data:import`. All four publish their tax roll
 * through the Florida Department of Revenue (FDOR) Property Tax Oversight data
 * portal: free, public, no login.
 * https://floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx
 */
export type CountyInfo = {
  slug: string;
  name: string;
  coNo: number; // FDOR county number
  fdorName: string; // name used in the FDOR file names
};

export const COUNTIES: CountyInfo[] = [
  { slug: "miami-dade", name: "Miami-Dade", coNo: 23, fdorName: "Dade" },
  { slug: "broward", name: "Broward", coNo: 16, fdorName: "Broward" },
  { slug: "palm-beach", name: "Palm Beach", coNo: 60, fdorName: "Palm Beach" },
  { slug: "monroe", name: "Monroe", coNo: 54, fdorName: "Monroe" },
];

export function countyBySlug(slug: string): CountyInfo | undefined {
  const s = slug.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return COUNTIES.find((c) => c.slug === s || c.fdorName.toLowerCase().replace(/\s+/g, "-") === s || c.name.toLowerCase().replace(/\s+/g, "-") === s);
}

export function countyByCoNo(coNo: number): CountyInfo | undefined {
  return COUNTIES.find((c) => c.coNo === coNo);
}

const FDOR_BASE =
  "https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/Tax%20Roll%20Data%20Files";

/** Direct download URL of a county's roll file ("NAL" = names/addresses/legal/values, "SDF" = sales). */
export function fdorUrl(c: CountyInfo, kind: "NAL" | "SDF", year = 2026, stage: "Final" | "Preliminary" = "Final"): string {
  const folder = `${year}${stage === "Final" ? "F" : "P"}`;
  const file = `${c.fdorName} ${String(c.coNo).padStart(2, "0")} ${stage} ${kind} ${year}.zip`;
  return `${FDOR_BASE}/${kind}/${folder}/${encodeURIComponent(file)}`;
}
