/** FDOR property use codes (DOR_UC) -> the property types shown in search. */
export const PROPERTY_TYPES = [
  "Single Family",
  "Condo",
  "Townhouse/Villa (2-9 units)",
  "Multi-Family 10+",
  "Mobile Home",
  "Co-op",
  "Retirement Home",
  "Misc Residential",
  "Vacant Residential",
  "Commercial",
  "Industrial",
  "Agricultural",
  "Institutional",
  "Governmental",
  "Other",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** DOR_UC is "001" (3-digit) in the NAL; some counties zero-pad differently. */
export function propertyTypeFromUse(use: string): PropertyType {
  const n = parseInt(use, 10);
  if (!Number.isFinite(n)) return "Other";
  if (n === 0) return "Vacant Residential";
  if (n === 1) return "Single Family";
  if (n === 2) return "Mobile Home";
  if (n === 3) return "Multi-Family 10+";
  if (n === 4) return "Condo";
  if (n === 5) return "Co-op";
  if (n === 6) return "Retirement Home";
  if (n === 7) return "Misc Residential";
  if (n === 8) return "Townhouse/Villa (2-9 units)";
  if (n === 9) return "Misc Residential";
  if (n >= 10 && n <= 39) return "Commercial";
  if (n >= 40 && n <= 49) return "Industrial";
  if (n >= 50 && n <= 69) return "Agricultural";
  if (n >= 70 && n <= 79) return "Institutional";
  if (n >= 80 && n <= 89) return "Governmental";
  return "Other";
}

/** Residential types where beds/baths/equity are meaningful. */
export function isResidentialType(t: string): boolean {
  return ["Single Family", "Condo", "Townhouse/Villa (2-9 units)", "Mobile Home", "Co-op", "Multi-Family 10+", "Misc Residential"].includes(t);
}
