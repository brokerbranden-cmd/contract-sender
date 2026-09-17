import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildContractVars, generateContractPdf } from "@/lib/pdf";
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

  const vars = buildContractVars({
    settings,
    deal,
    property: deal.property,
    agent: deal.agent,
  });

  // Allow override fields from request
  if (body.overrides) Object.assign(vars, body.overrides);

  const pdfBytes = await generateContractPdf(template.body, vars);
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
      message: `Contract PDF generated from template "${template.name}"`,
      meta: JSON.stringify({ contractId: contract.id, pdfPath }),
    },
  });

  return NextResponse.json(contract, { status: 201 });
}
