import type { Prisma, PrismaClient } from "@prisma/client";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { generateOfferPdf } from "./contract-gen";
import { interpolate } from "./utils";
import { buildEmailVars } from "./offer-utils";
import { getContractsDir } from "./paths";

type Db = PrismaClient | Prisma.TransactionClient;

const LOCKED_STAGES = ["under_contract", "closed"];
const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Send cap + duplicate guard                                          */
/* ------------------------------------------------------------------ */

export function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getSendCapStatus(db: Db, now = new Date()) {
  const settings = await db.settings.findUnique({ where: { id: "default" } });
  const cap = settings?.dailySendCap ?? 25;
  const since = startOfToday(now);
  const [outboxSent, legacySent, exportedPending] = await Promise.all([
    db.outboxItem.count({ where: { status: "sent", sentAt: { gte: since } } }),
    db.contract.count({
      where: { sentAt: { gte: since }, outboxItems: { none: {} } },
    }),
    db.outboxItem.count({
      where: { status: "ready", exportedAt: { gte: since } },
    }),
  ]);
  const sentToday = outboxSent + legacySent;
  return {
    cap,
    sentToday,
    exportedPending,
    remaining: Math.max(0, cap - sentToday),
    remainingForExport: Math.max(0, cap - sentToday - exportedPending),
  };
}

/** Returns a human-readable reason when this property was already offered within `days`. */
export async function findRecentOffer(
  db: Db,
  propertyId: string,
  days: number,
  opts: { excludeDealId?: string; now?: Date } = {}
): Promise<string | null> {
  if (!days || days <= 0) return null;
  const since = new Date((opts.now ?? new Date()).getTime() - days * DAY_MS);
  const sent = await db.outboxItem.findFirst({
    where: { status: "sent", sentAt: { gte: since }, deal: { propertyId } },
    orderBy: { sentAt: "desc" },
  });
  if (sent?.sentAt) return `Offer already sent ${sent.sentAt.toLocaleDateString("en-US")} (within ${days} days)`;
  const contract = await db.contract.findFirst({
    where: { sentAt: { gte: since }, deal: { propertyId } },
    orderBy: { sentAt: "desc" },
  });
  if (contract?.sentAt) return `Offer already sent ${contract.sentAt.toLocaleDateString("en-US")} (within ${days} days)`;
  const ready = await db.outboxItem.findFirst({
    where: {
      status: "ready",
      createdAt: { gte: since },
      deal: { propertyId },
      ...(opts.excludeDealId ? { dealId: { not: opts.excludeDealId } } : {}),
    },
  });
  if (ready) return `An offer for this property is already waiting in the Outbox`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Bulk offer creation                                                 */
/* ------------------------------------------------------------------ */

export type BulkOfferItem = {
  propertyId: string;
  offerPrice: number;
  subject?: string;
  body?: string;
};

export type BulkOfferParams = {
  templateId?: string | null;
  earnestMoney?: number | null;
  closingDays?: number | null;
  inspectionDays?: number | null;
  allowDuplicates?: boolean;
  /** "auto" | "custom" | "farbar"; omitted = template/settings default */
  contractType?: string | null;
  items: BulkOfferItem[];
};

export type BulkOfferResult = {
  propertyId: string;
  address: string;
  status: "created" | "skipped" | "error";
  reason?: string;
  warning?: string;
  dealId?: string;
  outboxId?: string;
  contractId?: string;
  pdfPath?: string;
};

export async function createBulkOffers(
  prisma: PrismaClient,
  params: BulkOfferParams
): Promise<{ results: BulkOfferResult[]; created: number; skipped: number; errors: number }> {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings) throw new Error("Settings missing");

  let template = params.templateId
    ? await prisma.contractTemplate.findUnique({ where: { id: params.templateId } })
    : null;
  if (!template) template = await prisma.contractTemplate.findFirst({ where: { isDefault: true } });
  if (!template) template = await prisma.contractTemplate.findFirst();
  if (!template) throw new Error("No contract template found");

  const earnest = params.earnestMoney ?? settings.defaultEarnest;
  const closingDays = params.closingDays ?? settings.defaultClosingDays;
  const inspectionDays = params.inspectionDays ?? settings.defaultInspectionDays;

  const dir = getContractsDir();
  await mkdir(dir, { recursive: true });

  const results: BulkOfferResult[] = [];

  for (const item of params.items) {
    const property = await prisma.property.findUnique({
      where: { id: item.propertyId },
      include: { listAgent: true },
    });
    if (!property) {
      results.push({ propertyId: item.propertyId, address: "?", status: "error", reason: "Property not found" });
      continue;
    }
    const base = { propertyId: property.id, address: `${property.address}, ${property.city}` };
    try {
      const offerPrice = Number(item.offerPrice);
      if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
        results.push({ ...base, status: "skipped", reason: "No offer price (missing list price?)" });
        continue;
      }

      // pick the deal: newest non-dead deal, else create
      let deal = await prisma.deal.findFirst({
        where: { propertyId: property.id, stage: { not: "dead" } },
        orderBy: { createdAt: "desc" },
        include: { agent: true },
      });
      if (deal && LOCKED_STAGES.includes(deal.stage)) {
        results.push({ ...base, status: "skipped", reason: `Deal is already ${deal.stage.replace("_", " ")}` });
        continue;
      }

      if (!params.allowDuplicates) {
        const dup = await findRecentOffer(prisma, property.id, settings.duplicateGuardDays, {
          excludeDealId: deal?.id,
        });
        if (dup) {
          results.push({ ...base, status: "skipped", reason: `Duplicate guard: ${dup}` });
          continue;
        }
      }

      const agent = deal?.agent ?? property.listAgent ?? null;

      if (!deal) {
        deal = await prisma.deal.create({
          data: {
            title: `${property.address}${property.city ? `, ${property.city}` : ""}`,
            stage: "new",
            propertyId: property.id,
            agentId: agent?.id ?? null,
          },
          include: { agent: true },
        });
        await prisma.activity.create({
          data: { dealId: deal.id, type: "created", message: `Deal created: ${deal.title}` },
        });
      }

      const dealTerms = {
        offerPrice,
        earnestMoney: earnest,
        closingDays,
        inspectionDays,
        financingType: "Cash",
        contingencies: deal.contingencies ?? "None — AS-IS cash purchase, no financing contingency",
        notes: deal.notes,
      };

      const gen = await generateOfferPdf({
        settings,
        template,
        deal: { ...dealTerms, contractType: deal.contractType },
        property,
        agent,
        contractType: params.contractType,
      });
      const contractVars = gen.vars;
      const pdfBytes = gen.bytes;
      const filename = `contract-${deal.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}.pdf`;
      await writeFile(path.join(dir, filename), pdfBytes);
      const pdfPath = `/contracts/${filename}`;

      const emailVars = buildEmailVars({
        settings,
        property,
        agent,
        offerPrice,
        earnestMoney: earnest,
        closingDays,
        inspectionDays,
      });
      const subject = interpolate(item.subject?.trim() ? item.subject : settings.emailSubjectTpl, emailVars);
      const body = interpolate(item.body?.trim() ? item.body : settings.emailBodyTpl, emailVars);

      const contract = await prisma.contract.create({
        data: {
          dealId: deal.id,
          templateId: template.id,
          filledData: JSON.stringify(contractVars),
          status: "generated",
          pdfPath,
        },
      });

      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          ...dealTerms,
          stage: "offer_drafted",
          agentId: deal.agentId ?? agent?.id ?? null,
        },
      });

      // supersede any previous ready outbox item for this deal
      await prisma.outboxItem.updateMany({
        where: { dealId: deal.id, status: "ready" },
        data: { status: "cancelled" },
      });
      const outbox = await prisma.outboxItem.create({
        data: {
          dealId: deal.id,
          contractId: contract.id,
          toEmail: agent?.email ?? "",
          subject,
          body,
          pdfPath,
        },
      });

      await prisma.activity.create({
        data: {
          dealId: deal.id,
          type: "contract_generated",
          message: `Bulk offer drafted at $${offerPrice.toLocaleString("en-US")} (${gen.contractType === "farbar" ? "FAR/BAR AS IS form" : `template "${template.name}"`}). Queued in Outbox.`,
          meta: JSON.stringify({ contractId: contract.id, outboxId: outbox.id, pdfPath }),
        },
      });

      results.push({
        ...base,
        status: "created",
        warning: agent?.email ? undefined : "No agent email — add one in the Outbox before sending",
        dealId: deal.id,
        outboxId: outbox.id,
        contractId: contract.id,
        pdfPath,
      });
    } catch (e) {
      results.push({ ...base, status: "error", reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    results,
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
  };
}
