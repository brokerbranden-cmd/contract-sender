import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { interpolate } from "./utils";

export async function generateContractPdf(
  templateBody: string,
  vars: Record<string, string>
): Promise<Uint8Array> {
  const text = interpolate(templateBody, vars);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;
  const fontSize = 10;
  const lineHeight = 14;
  const titleSize = 12;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const lines = wrapText(text, font, fontSize, maxWidth);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    const isTitle = i === 0 || line.startsWith("FLORIDA INVESTOR");
    const isSection =
      line.endsWith(":") &&
      !line.includes(" ") &&
      line.length < 40
        ? false
        : /^(BUYER:|SELLER|PROPERTY:|OFFER TERMS:|ADDITIONAL|ACKNOWLEDGMENT)/.test(
            line
          ) ||
          (line === line.toUpperCase() &&
            line.length > 3 &&
            line.length < 60 &&
            !line.includes("{{"));

    const useBold = isTitle || isSection;
    const size = isTitle ? titleSize : fontSize;
    page.drawText(line || " ", {
      x: margin,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.1, 0.1, 0.15),
    });
    y -= isTitle ? lineHeight + 4 : lineHeight;
  }

  return pdfDoc.save();
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number
): string[] {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (const raw of rawLines) {
    if (!raw.trim()) {
      out.push("");
      continue;
    }
    const words = raw.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
        out.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

export function buildContractVars(input: {
  settings: {
    buyerName: string;
    buyerEntity: string;
    buyerAddress: string;
    buyerCity: string;
    buyerState: string;
    buyerZip: string;
    buyerEmail: string;
    buyerPhone: string;
    buyerSignatory: string;
  };
  deal: {
    offerPrice: number | null;
    earnestMoney: number | null;
    closingDays: number | null;
    inspectionDays: number | null;
    financingType: string | null;
    contingencies: string | null;
    notes: string | null;
  };
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    mlsNumber: string | null;
    listPrice: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    yearBuilt: number | null;
    propertyType: string | null;
  };
  agent: {
    name: string;
    email: string | null;
    phone: string | null;
    brokerage: string | null;
  } | null;
}): Record<string, string> {
  const money = (n: number | null | undefined) =>
    n == null
      ? "—"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n);

  const s = input.settings;
  const d = input.deal;
  const p = input.property;
  const a = input.agent;

  return {
    offerDate: new Date().toLocaleDateString("en-US"),
    buyerName: s.buyerName,
    buyerEntity: s.buyerEntity,
    buyerAddress: s.buyerAddress,
    buyerCity: s.buyerCity,
    buyerState: s.buyerState,
    buyerZip: s.buyerZip,
    buyerEmail: s.buyerEmail,
    buyerPhone: s.buyerPhone,
    buyerSignatory: s.buyerSignatory,
    agentName: a?.name ?? "TBD",
    agentBrokerage: a?.brokerage ?? "",
    agentEmail: a?.email ?? "",
    agentPhone: a?.phone ?? "",
    propertyAddress: p.address,
    propertyCity: p.city,
    propertyState: p.state,
    propertyZip: p.zip,
    mlsNumber: p.mlsNumber ?? "",
    propertyType: p.propertyType ?? "",
    beds: p.beds?.toString() ?? "",
    baths: p.baths?.toString() ?? "",
    sqft: p.sqft?.toString() ?? "",
    yearBuilt: p.yearBuilt?.toString() ?? "",
    listPrice: money(p.listPrice),
    offerPrice: money(d.offerPrice),
    earnestMoney: money(d.earnestMoney),
    closingDays: d.closingDays?.toString() ?? "",
    inspectionDays: d.inspectionDays?.toString() ?? "",
    financingType: d.financingType ?? "Cash",
    contingencies: d.contingencies ?? "None",
    notes: d.notes ?? "",
  };
}
