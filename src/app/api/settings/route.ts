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
    ...(body.emailSubjectTpl != null && {
      emailSubjectTpl: String(body.emailSubjectTpl),
    }),
    ...(body.emailBodyTpl != null && { emailBodyTpl: String(body.emailBodyTpl) }),
  };
}
