import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOfferPdf } from "@/lib/contract-gen";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const deal = await prisma.deal.findUnique({
    where: { id: body.dealId },
    include: { property: true, agent: true },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  let template = body.templateId
    ? await prisma.contractTemplate.findUnique({ where: { id: body.templateId } })
    : await prisma.contractTemplate.findFirst({ where: { isDefault: true } });

  if (!template) {
    template = await prisma.contractTemplate.findFirst();
  }
  if (!template) {
    return NextResponse.json({ error: "No template found" }, { status: 400 });
  }

  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings) {
    return NextResponse.json({ error: "Settings missing" }, { status: 500 });
  }

  let gen;
  try {
    gen = await generateOfferPdf({
      settings,
      template,
      deal,
      property: deal.property,
      agent: deal.agent,
      contractType: body.contractType ?? null,
      overrides: body.overrides,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
  const vars = gen.vars;
  const pdfBytes = gen.bytes;
  const dir = path.join(process.cwd(), "public", "contracts");
  await mkdir(dir, { recursive: true });
  const filename = `contract-${deal.id}-${Date.now()}.pdf`;
  const pdfPath = `/contracts/${filename}`;
  await writeFile(path.join(dir, filename), pdfBytes);

  const contract = await prisma.contract.create({
    data: {
      dealId: deal.id,
      templateId: template.id,
      filledData: JSON.stringify(vars),
      status: "generated",
      pdfPath,
    },
    include: { template: true },
  });

  if (deal.stage === "new" || deal.stage === "researching") {
    await prisma.deal.update({
      where: { id: deal.id },
      data: { stage: "offer_drafted" },
    });
  }

  await prisma.activity.create({
    data: {
      dealId: deal.id,
      type: "contract_generated",
      message: gen.contractType === "farbar" ? "Contract PDF generated on the FAR/BAR AS IS form" : `Contract PDF generated from template "${template.name}"`,
      meta: JSON.stringify({ contractId: contract.id, pdfPath }),
    },
  });

  return NextResponse.json(contract, { status: 201 });
}
