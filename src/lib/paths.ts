import path from "path";

/** Where generated offer PDFs are written. Override with CONTRACTS_DIR (used by tests). */
export function getContractsDir(): string {
  return process.env.CONTRACTS_DIR || path.join(process.cwd(), "public", "contracts");
}
