import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: "default" } });
  }
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    create: { id: "default", ...sanitize(body) },
    update: sanitize(body),
  });
  return NextResponse.json(settings);
}

function sanitize(body: Record<string, unknown>) {
  const num = (v: unknown) => (v != null && v !== "" ? Number(v) : undefined);
  return {
    ...(body.buyerName != null && { buyerName: String(body.buyerName) }),
    ...(body.buyerEntity != null && { buyerEntity: String(body.buyerEntity) }),
    ...(body.buyerAddress != null && { buyerAddress: String(body.buyerAddress) }),
    ...(body.buyerCity != null && { buyerCity: String(body.buyerCity) }),
    ...(body.buyerState != null && { buyerState: String(body.buyerState) }),
    ...(body.buyerZip != null && { buyerZip: String(body.buyerZip) }),
    ...(body.buyerEmail != null && { buyerEmail: String(body.buyerEmail) }),
    ...(body.buyerPhone != null && { buyerPhone: String(body.buyerPhone) }),
    ...(body.buyerSignatory != null && {
      buyerSignatory: String(body.buyerSignatory),
    }),
    ...(body.defaultEarnest !== undefined && {
      defaultEarnest: num(body.defaultEarnest) ?? 1000,
    }),
    ...(body.defaultClosingDays !== undefined && {
      defaultClosingDays: num(body.defaultClosingDays) ?? 30,
    }),
    ...(body.defaultInspectionDays !== undefined && {
      defaultInspectionDays: num(body.defaultInspectionDays) ?? 10,
    }),
    ...(body.dailySendCap !== undefined && {
      dailySendCap: Math.max(0, Math.round(num(body.dailySendCap) ?? 25)),
    }),
    ...(body.duplicateGuardDays !== undefined && {
      duplicateGuardDays: Math.max(0, Math.round(num(body.duplicateGuardDays) ?? 30)),
    }),
    ...(body.defaultOfferPct !== undefined && {
      defaultOfferPct: num(body.defaultOfferPct) ?? 75,
    }),
    ...(body.emailSubjectTpl != null && {
      emailSubjectTpl: String(body.emailSubjectTpl),
    }),
    ...(body.defaultContractType != null && { defaultContractType: String(body.defaultContractType) }),
    ...(body.farbarFormPath != null && { farbarFormPath: String(body.farbarFormPath) }),
    ...(body.escrowAgentName != null && { escrowAgentName: String(body.escrowAgentName) }),
    ...(body.escrowAgentAddress != null && { escrowAgentAddress: String(body.escrowAgentAddress) }),
    ...(body.escrowAgentPhone != null && { escrowAgentPhone: String(body.escrowAgentPhone) }),
    ...(body.escrowAgentEmail != null && { escrowAgentEmail: String(body.escrowAgentEmail) }),
    ...(body.escrowAgentFax != null && { escrowAgentFax: String(body.escrowAgentFax) }),
    ...(body.assignability != null && { assignability: String(body.assignability) }),
    ...(body.cooperatingSalesAssociate != null && { cooperatingSalesAssociate: String(body.cooperatingSalesAssociate) }),
    ...(body.cooperatingBroker != null && { cooperatingBroker: String(body.cooperatingBroker) }),
    ...(body.farbarAdditionalTerms != null && { farbarAdditionalTerms: String(body.farbarAdditionalTerms) }),
    ...(body.depositDays !== undefined && { depositDays: Math.max(0, Math.round(num(body.depositDays) ?? 3)) }),
    ...(body.acceptanceDays !== undefined && { acceptanceDays: Math.max(0, Math.round(num(body.acceptanceDays) ?? 3)) }),
    ...(body.emailBodyTpl != null && { emailBodyTpl: String(body.emailBodyTpl) }),
  };
}
