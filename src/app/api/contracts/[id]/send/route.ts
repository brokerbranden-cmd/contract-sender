import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { interpolate } from "@/lib/utils";

/**
 * Email MVP: builds mailto + preview and marks contract/deal as sent.
 * Hook for Resend later:
 *   // import { Resend } from "resend";
 *   // const resend = new Resend(process.env.RESEND_API_KEY);
 *   // await resend.emails.send({ from, to, subject, html, attachments: [pdf] });
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      deal: { include: { property: true, agent: true } },
    },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings) {
    return NextResponse.json({ error: "Settings missing" }, { status: 500 });
  }

  const deal = contract.deal;
  const agent = deal.agent;
  const property = deal.property;
  const filled = JSON.parse(contract.filledData || "{}") as Record<string, string>;

  const vars: Record<string, string> = {
    ...filled,
    address: `${property.address}, ${property.city}`,
    agentName: agent?.name ?? "Agent",
    buyerName: settings.buyerName,
    buyerSignatory: settings.buyerSignatory,
    buyerPhone: settings.buyerPhone,
    buyerEmail: settings.buyerEmail,
    offerPrice: filled.offerPrice ?? "",
    closingDays: filled.closingDays ?? String(deal.closingDays ?? ""),
  };

  const subject = interpolate(settings.emailSubjectTpl, vars);
  const emailBody = interpolate(settings.emailBodyTpl, vars);
  const to = body.to || agent?.email || "";

  const mailto = to
    ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`
    : null;

  await prisma.contract.update({
    where: { id: contract.id },
    data: { status: "sent", sentAt: new Date() },
  });

  await prisma.deal.update({
    where: { id: deal.id },
    data: { stage: "sent" },
  });

  await prisma.activity.create({
    data: {
      dealId: deal.id,
      type: "email_sent",
      message: `Offer marked sent${to ? ` to ${to}` : ""}. Open mailto to email agent.`,
      meta: JSON.stringify({ contractId: contract.id, to, subject }),
    },
  });

  return NextResponse.json({
    ok: true,
    mailto,
    preview: { to, subject, body: emailBody, pdfPath: contract.pdfPath },
    // Resend hook placeholder — wire when RESEND_API_KEY is set
    resendReady: false,
  });
}
