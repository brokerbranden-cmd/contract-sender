/** Client-safe helpers for bulk offers (no Node / Prisma imports). */

export const OFFER_ROUND_TO = 1000;
export const DEFAULT_OFFER_PCT = 75;

export function roundOffer(
  listPrice: number | null | undefined,
  pct: number,
  roundTo = OFFER_ROUND_TO
): number | null {
  if (listPrice == null || !Number.isFinite(listPrice) || listPrice <= 0) return null;
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.round((listPrice * pct) / 100 / roundTo) * roundTo;
}

/** "Smith, John A" -> "John"; "John A. Smith" -> "John"; "" -> "" */
export function agentFirstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "";
  if (n.includes(",")) {
    const after = n.split(",")[1]?.trim() ?? "";
    return after.split(/\s+/)[0] ?? "";
  }
  return n.split(/\s+/)[0] ?? "";
}

export function money(n: number | null | undefined): string {
  if (n == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export type EmailVarInput = {
  settings: {
    buyerName: string;
    buyerEntity?: string;
    buyerSignatory: string;
    buyerPhone: string;
    buyerEmail: string;
  };
  property: {
    address: string;
    city: string;
    state?: string;
    zip: string;
    mlsNumber: string | null;
    listPrice: number | null;
  };
  agent: { name: string; email: string | null; phone?: string | null; brokerage?: string | null } | null;
  offerPrice: number | null;
  earnestMoney: number | null;
  closingDays: number | null;
  inspectionDays?: number | null;
};

/**
 * Placeholder variables for email subject/body. Each variable is available in
 * both camelCase (existing templates: {{agentName}}, {{offerPrice}}) and
 * snake_case ({{offer_price}}, {{agent_first_name}}).
 */
export function buildEmailVars(i: EmailVarInput): Record<string, string> {
  const first = agentFirstName(i.agent?.name);
  const street = i.property.address;
  const vars: Record<string, string> = {
    address: `${street}${i.property.city ? `, ${i.property.city}` : ""}`,
    street,
    city: i.property.city,
    state: i.property.state ?? "FL",
    zip: i.property.zip,
    mls_number: i.property.mlsNumber ?? "",
    list_price: money(i.property.listPrice),
    offer_price: money(i.offerPrice),
    earnest_money: money(i.earnestMoney),
    closing_days: i.closingDays != null ? String(i.closingDays) : "",
    inspection_days: i.inspectionDays != null ? String(i.inspectionDays) : "",
    agent_name: i.agent?.name ?? "",
    agent_first_name: first || "there",
    agent_email: i.agent?.email ?? "",
    agent_phone: i.agent?.phone ?? "",
    agent_brokerage: i.agent?.brokerage ?? "",
    buyer_name: i.settings.buyerName,
    buyer_entity: i.settings.buyerEntity ?? i.settings.buyerName,
    buyer_signatory: i.settings.buyerSignatory,
    buyer_phone: i.settings.buyerPhone,
    buyer_email: i.settings.buyerEmail,
  };
  // camelCase aliases (matches the existing Settings email templates)
  const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  for (const [k, v] of Object.entries({ ...vars })) {
    const c = camel(k);
    if (c !== k) vars[c] = v;
  }
  vars.agentName = i.agent?.name || first || "there";
  vars.mlsNumber = vars.mls_number;
  return vars;
}

export const EMAIL_PLACEHOLDERS = [
  "address",
  "street",
  "city",
  "zip",
  "mls_number",
  "list_price",
  "offer_price",
  "earnest_money",
  "closing_days",
  "inspection_days",
  "agent_first_name",
  "agent_name",
  "buyer_name",
  "buyer_signatory",
  "buyer_phone",
  "buyer_email",
];

export function buildMailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
export const OFFER_SELECTION_KEY = "offerSelection";
