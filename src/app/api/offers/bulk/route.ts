import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBulkOffers } from "@/lib/offers";

export const dynamic = "force-dynamic";

/**
 * POST {
 *   templateId?, contractType? (auto|custom|farbar), earnestMoney?, closingDays?, inspectionDays?, allowDuplicates?,
 *   items: [{ propertyId, offerPrice, subject?, body? }]
 * }
 * Generates a PDF per listing, moves deals to offer_drafted and queues the email in the Outbox.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }
  if (body.items.length > 500) {
    return NextResponse.json({ error: "Max 500 offers per batch" }, { status: 400 });
  }
  const n = (v: unknown) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  try {
    const out = await createBulkOffers(prisma, {
      templateId: body.templateId || null,
      earnestMoney: n(body.earnestMoney),
      closingDays: n(body.closingDays),
      inspectionDays: n(body.inspectionDays),
      allowDuplicates: !!body.allowDuplicates,
      contractType: ["auto", "custom", "farbar"].includes(body.contractType) ? body.contractType : null,
      items: body.items.map((i: Record<string, unknown>) => ({
        propertyId: String(i.propertyId),
        offerPrice: Number(i.offerPrice),
        subject: typeof i.subject === "string" ? i.subject : undefined,
        body: typeof i.body === "string" ? i.body : undefined,
      })),
    });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
