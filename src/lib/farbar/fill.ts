import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import fieldMap from "./asis-field-map.json";

/**
 * Auto-fill for the licensed Florida Realtors/Florida Bar "AS IS" Residential
 * Contract (FloridaRealtors/FloridaBar-ASIS-7x, Rev 2/26).
 *
 * The form itself is NOT in this repo (it is licensed to the member). Drop
 * your own flattened copy at forms/farbar-asis.pdf, or point FARBAR_ASIS_PATH /
 * Settings → "FAR/BAR form path" at it. We only overlay text at the fixed
 * coordinates in asis-field-map.json.
 */

export type ContractType = "auto" | "custom" | "farbar";
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  auto: "Auto (FAR/BAR if form present, else custom)",
  custom: "Custom AS-IS (built-in)",
  farbar: "FAR/BAR AS IS (official form)",
};

type TextField = { type: "text"; page: number; x: number; y: number; maxWidth: number; fontSize: number; align?: "left" | "right" | "center" };
type MultiField = { type: "multiline"; page: number; fontSize: number; lines: { x: number; y: number; maxWidth: number }[] };
type CheckField = { type: "checkbox"; page: number; x: number; y: number; size: number };
export type FieldDef = TextField | MultiField | CheckField;
export const FARBAR_FIELD_MAP = fieldMap as unknown as { form: string; pageSize: [number, number]; fields: Record<string, FieldDef> };

export const DEFAULT_FARBAR_RELATIVE_PATH = path.join("forms", "farbar-asis.pdf");

export function resolveFarBarPath(settingsPath?: string | null): string {
  const p = (settingsPath && settingsPath.trim()) || process.env.FARBAR_ASIS_PATH || DEFAULT_FARBAR_RELATIVE_PATH;
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

export function farBarFormExists(settingsPath?: string | null): boolean {
  return existsSync(resolveFarBarPath(settingsPath));
}

/** deal → template → settings default; "auto" resolves to farbar when the form file exists. */
export function resolveContractType(
  choices: (string | null | undefined)[],
  formExists: boolean
): "custom" | "farbar" {
  const pick = choices.find((c) => c && c !== "auto") as ContractType | undefined;
  if (pick === "custom") return "custom";
  if (pick === "farbar") return formExists ? "farbar" : "custom";
  return formExists ? "farbar" : "custom";
}

export type FarBarSettings = {
  buyerName: string;
  buyerEntity: string;
  buyerAddress: string;
  buyerCity: string;
  buyerState: string;
  buyerZip: string;
  buyerSignatory?: string;
  defaultClosingDays: number;
  defaultInspectionDays: number;
  defaultEarnest: number;
  escrowAgentName?: string | null;
  escrowAgentAddress?: string | null;
  escrowAgentPhone?: string | null;
  escrowAgentEmail?: string | null;
  escrowAgentFax?: string | null;
  depositDays?: number | null;
  acceptanceDays?: number | null;
  assignability?: string | null; // assign_released | assign_not_released | no_assign | ""
  cooperatingSalesAssociate?: string | null;
  cooperatingBroker?: string | null;
  farbarAdditionalTerms?: string | null;
  farbarFormPath?: string | null;
};

export type FarBarDeal = {
  offerPrice: number | null;
  earnestMoney: number | null;
  additionalDeposit?: number | null;
  additionalDepositDays?: number | null;
  loanAmount?: number | null;
  closingDays: number | null;
  inspectionDays: number | null;
  financingType?: string | null;
  sellerName?: string | null;
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    county?: string | null;
    parcelId?: string | null;
    legalDescription?: string | null;
  };
  agent?: { name: string; brokerage?: string | null } | null;
  listOfficeName?: string | null;
};

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Pure: compute the value for every field id. Strings for text, booleans for checkboxes. */
export function buildFarBarValues(
  deal: FarBarDeal,
  s: FarBarSettings,
  now = new Date()
): Record<string, string | boolean> {
  const price = deal.offerPrice ?? 0;
  const dep1 = deal.earnestMoney ?? s.defaultEarnest ?? 0;
  const dep2 = deal.additionalDeposit ?? 0;
  const isCash = !deal.financingType || /cash/i.test(deal.financingType);
  const loan = isCash ? 0 : deal.loanAmount ?? 0;
  const balance = price - dep1 - dep2 - loan;
  const closingDays = deal.closingDays ?? s.defaultClosingDays;
  const inspection = deal.inspectionDays ?? s.defaultInspectionDays;
  const p = deal.property;
  const buyer = s.buyerEntity || s.buyerName;
  const cityLine = [s.buyerCity, [s.buyerState, s.buyerZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const assign = s.assignability ?? "";

  const v: Record<string, string | boolean> = {
    seller: deal.sellerName ?? "",
    buyer,
    propertyAddress: [p.address, p.city, [p.state || "FL", p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    county: (p.county ?? "").replace(/\s+county$/i, ""),
    taxId: p.parcelId ?? "",
    legalDescription: p.legalDescription ?? "",
    personalPropertyIncluded: "",
    personalPropertyExcluded: "",
    purchasePrice: price ? money(price) : "",
    initialDeposit: dep1 ? money(dep1) : "",
    depositAccompaniesOffer: false,
    depositWithinDays: true,
    depositDays: String(s.depositDays ?? 3),
    escrowAgentName: s.escrowAgentName ?? "",
    escrowAgentAddress: s.escrowAgentAddress ?? "",
    escrowAgentPhone: s.escrowAgentPhone ?? "",
    escrowAgentEmail: s.escrowAgentEmail ?? "",
    escrowAgentFax: s.escrowAgentFax ?? "",
    additionalDepositDays: dep2 ? String(deal.additionalDepositDays ?? 10) : "",
    additionalDeposit: dep2 ? money(dep2) : "",
    loanAmount: loan ? money(loan) : "",
    otherDescription: "",
    otherAmount: "",
    balanceToClose: price ? money(balance) : "",
    acceptanceDeadline: s.acceptanceDays ? fmtDate(addDays(now, s.acceptanceDays)) : "",
    closingDate: fmtDate(addDays(now, closingDays)),
    assignReleased: assign === "assign_released",
    assignNotReleased: assign === "assign_not_released",
    assignNotAllowed: assign === "no_assign",
    financingCash: isCash,
    financingLoan: !isCash,
    loanApprovalDays: "",
    inspectionDays: String(inspection),
    additionalTerms: s.farbarAdditionalTerms ?? "",
    buyer1PrintedName: s.buyerSignatory && s.buyerSignatory !== buyer ? `${buyer} by ${s.buyerSignatory}` : buyer,
    buyer1Date: fmtDate(now),
    buyer2PrintedName: "",
    buyer2Date: "",
    buyerNoticeAddress: [buyer, s.buyerAddress, cityLine].filter(Boolean).join("\n"),
    cooperatingSalesAssociate: s.cooperatingSalesAssociate ?? "",
    cooperatingBroker: s.cooperatingBroker ?? "",
    listingSalesAssociate: deal.agent?.name ?? "",
    listingBroker: deal.agent?.brokerage || deal.listOfficeName || "",
  };
  return v;
}

function fitSize(font: PDFFont, text: string, size: number, maxWidth: number, min = 5.5) {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.25;
  return s;
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, maxWidth: number, size: number, align = "left") {
  if (!text) return;
  const s = fitSize(font, text, size, maxWidth);
  const w = font.widthOfTextAtSize(text, s);
  const dx = align === "right" ? maxWidth - w : align === "center" ? (maxWidth - w) / 2 : 0;
  page.drawText(text, { x: x + Math.max(0, dx), y, size: s, font, color: rgb(0, 0, 0.55) });
}

/** Wrap text across the given lines (explicit \n starts a new line). Last line auto-shrinks. */
export function wrapToLines(
  text: string,
  widths: number[],
  measure: (t: string) => number
): string[] {
  const out: string[] = [];
  const words: string[] = [];
  text.replace(/\r\n/g, "\n").split("\n").forEach((para, i) => {
    if (i > 0) words.push("\n");
    words.push(...para.split(/\s+/).filter(Boolean));
  });
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const li = out.length;
    if (li >= widths.length - 1) {
      // last line: dump the rest
      cur = (cur + " " + words.slice(i).filter((x) => x !== "\n").join(" ")).trim();
      break;
    }
    if (w === "\n") {
      out.push(cur);
      cur = "";
      continue;
    }
    const t = cur ? `${cur} ${w}` : w;
    if (measure(t) > widths[li] && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur || out.length === 0) out.push(cur);
  return out.slice(0, widths.length);
}

export async function fillFarBarValues(
  formBytes: Uint8Array,
  values: Record<string, string | boolean>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(formBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  for (const [id, def] of Object.entries(FARBAR_FIELD_MAP.fields)) {
    const val = values[id];
    if (val === undefined || val === "" || val === false) continue;
    const page = pages[def.page - 1];
    if (!page) continue;
    if (def.type === "checkbox") {
      const pad = 1.5;
      const { x, y, size } = def;
      const opts = { thickness: 1.2, color: rgb(0, 0, 0.55) };
      page.drawLine({ start: { x: x + pad, y: y + pad }, end: { x: x + size - pad, y: y + size - pad }, ...opts });
      page.drawLine({ start: { x: x + pad, y: y + size - pad }, end: { x: x + size - pad, y: y + pad }, ...opts });
    } else if (def.type === "text") {
      drawText(page, font, String(val), def.x, def.y, def.maxWidth, def.fontSize, def.align);
    } else {
      const lines = wrapToLines(String(val), def.lines.map((l) => l.maxWidth), (t) => font.widthOfTextAtSize(t, def.fontSize));
      lines.forEach((t, i) => {
        const l = def.lines[i];
        drawText(page, font, t, l.x, l.y, l.maxWidth, def.fontSize);
      });
    }
  }
  void bold;
  return doc.save();
}

/** Load the licensed form, overlay values for this deal, return PDF bytes. */
export async function fillFarBarAsIs(
  deal: FarBarDeal,
  settings: FarBarSettings,
  opts: { formPath?: string; now?: Date; overrides?: Record<string, string | boolean> } = {}
): Promise<Uint8Array> {
  const formPath = opts.formPath ?? resolveFarBarPath(settings.farbarFormPath);
  if (!existsSync(formPath)) {
    throw new Error(
      `FAR/BAR AS IS form not found at ${formPath}. Put your licensed copy at forms/farbar-asis.pdf (or set FARBAR_ASIS_PATH / Settings).`
    );
  }
  const bytes = await readFile(formPath);
  const values = { ...buildFarBarValues(deal, settings, opts.now), ...(opts.overrides ?? {}) };
  return fillFarBarValues(bytes, values);
}
