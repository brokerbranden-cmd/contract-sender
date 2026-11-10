/**
 * Derived (computed) parcel fields.
 *
 * $/sqft  = just (market) value / living area.
 * Est. equity — public records do not include mortgages, so this is a rough
 * estimate and is labelled as such everywhere in the UI:
 *   - no sale on record, or last sale older than 30 years  -> assume free & clear
 *   - otherwise assume the buyer financed 80% of the last (arm's-length, >$10k)
 *     sale price on a 30-year fixed at 6.5% and compute the balance today.
 * equity = just value - estimated balance.
 */
export const EST_LTV = 0.8;
export const EST_RATE = 0.065;
export const EST_TERM_YEARS = 30;

export function estLoanBalance(salePrice: number, saleDate: string, today = new Date()): number {
  const d = new Date(saleDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return 0;
  const monthsElapsed = Math.max(
    0,
    (today.getUTCFullYear() - d.getUTCFullYear()) * 12 + (today.getUTCMonth() - d.getUTCMonth()),
  );
  const n = EST_TERM_YEARS * 12;
  if (monthsElapsed >= n) return 0;
  const P = salePrice * EST_LTV;
  const r = EST_RATE / 12;
  const pay = (P * r) / (1 - Math.pow(1 + r, -n));
  const bal = P * Math.pow(1 + r, monthsElapsed) - (pay * (Math.pow(1 + r, monthsElapsed) - 1)) / r;
  return Math.max(0, Math.round(bal));
}

export function computeEquity(
  justValue: number | null,
  lastSalePrice: number | null,
  lastSaleDate: string | null,
  today = new Date(),
): { estEquity: number | null; estEquityPct: number | null } {
  if (!justValue || justValue <= 0) return { estEquity: null, estEquityPct: null };
  let bal = 0;
  if (lastSalePrice && lastSalePrice > 10000 && lastSaleDate) {
    bal = estLoanBalance(lastSalePrice, lastSaleDate, today);
  }
  const eq = Math.round(justValue - bal);
  return { estEquity: eq, estEquityPct: Math.round((eq / justValue) * 1000) / 10 };
}

export function computePpsf(justValue: number | null, livingArea: number | null): number | null {
  if (!justValue || !livingArea || livingArea <= 0) return null;
  return Math.round((justValue / livingArea) * 100) / 100;
}
