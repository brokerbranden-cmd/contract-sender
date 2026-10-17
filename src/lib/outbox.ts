import type { Prisma, PrismaClient } from "@prisma/client";
import path from "path";
import { randomUUID } from "crypto";
import { getContractsDir } from "./paths";
import { getSendCapStatus } from "./offers";

type Db = PrismaClient | Prisma.TransactionClient;

export type MarkSentResult =
  | { ok: true; outboxId: string; dealId: string }
  | { ok: false; reason: "not_found" | "already_sent" | "cancelled" | "cap_reached"; message: string };

/** Mark one outbox item sent: outbox -> sent, contract -> sent, deal -> sent, activity logged. */
export async function markOutboxSent(
  db: Db,
  outboxId: string,
  opts: { sentAt?: Date; force?: boolean; enforceCap?: boolean; via?: string } = {}
): Promise<MarkSentResult> {
  const item = await db.outboxItem.findUnique({ where: { id: outboxId } });
  if (!item) return { ok: false, reason: "not_found", message: "Outbox item not found" };
  if (item.status === "sent") return { ok: false, reason: "already_sent", message: "Already marked sent" };
  if (item.status === "cancelled") return { ok: false, reason: "cancelled", message: "Item was cancelled/superseded" };

  if (opts.enforceCap && !opts.force) {
    const cap = await getSendCapStatus(db);
    if (cap.remaining <= 0) {
      return {
        ok: false,
        reason: "cap_reached",
        message: `Daily send cap reached (${cap.sentToday}/${cap.cap}).`,
      };
    }
  }

  const sentAt = opts.sentAt ?? new Date();
  await db.outboxItem.update({ where: { id: item.id }, data: { status: "sent", sentAt } });
  if (item.contractId) {
    await db.contract.update({ where: { id: item.contractId }, data: { status: "sent", sentAt } });
  }
  await db.deal.update({ where: { id: item.dealId }, data: { stage: "sent" } });
  await db.activity.create({
    data: {
      dealId: item.dealId,
      type: "email_sent",
      message: `Offer marked sent${item.toEmail ? ` to ${item.toEmail}` : ""}${opts.via ? ` (${opts.via})` : ""}.`,
      meta: JSON.stringify({ outboxId: item.id, to: item.toEmail, subject: item.subject }),
    },
  });
  return { ok: true, outboxId: item.id, dealId: item.dealId };
}

/* ------------------------------------------------------------------ */
/* outbox-batch.json                                                   */
/* ------------------------------------------------------------------ */

export type OutboxBatchItem = {
  dealId: string;
  outboxId: string;
  to: string;
  subject: string;
  body: string; // plain text
  pdfPath: string; // absolute path on the machine running this app
  pdfFileName: string;
  pdfUrlPath: string; // e.g. /contracts/xyz.pdf (served by this app)
  mlsNumber: string | null;
  address: string;
  offerPrice: number | null;
  agentName: string | null;
};

export type OutboxBatch = {
  schemaVersion: 1;
  batchId: string;
  generatedAt: string;
  from: { name: string; email: string };
  dailyCap: number;
  sentToday: number;
  count: number;
  skippedNoEmail: number;
  skippedByCap: number;
  note: string;
  items: OutboxBatchItem[];
};

export async function exportBatch(
  db: Db,
  opts: { ids?: string[]; ignoreCap?: boolean; includeExported?: boolean } = {}
): Promise<OutboxBatch> {
  const settings = await db.settings.findUnique({ where: { id: "default" } });
  const cap = await getSendCapStatus(db);
  const ready = await db.outboxItem.findMany({
    where: {
      status: "ready",
      ...(opts.ids?.length ? { id: { in: opts.ids } } : {}),
      ...(opts.includeExported ? {} : { exportedAt: null }),
    },
    orderBy: { createdAt: "asc" },
    include: { deal: { include: { property: true, agent: true } } },
  });

  const withEmail = ready.filter((r) => r.toEmail.trim());
  const skippedNoEmail = ready.length - withEmail.length;
  const limit = opts.ignoreCap
    ? withEmail.length
    : opts.includeExported
      ? cap.remaining
      : cap.remainingForExport;
  const chosen = withEmail.slice(0, limit);
  const skippedByCap = withEmail.length - chosen.length;

  const batchId = `batch-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const dir = getContractsDir();
  const now = new Date();

  const items: OutboxBatchItem[] = chosen.map((r) => {
    const file = path.basename(r.pdfPath ?? "");
    return {
      dealId: r.dealId,
      outboxId: r.id,
      to: r.toEmail.trim(),
      subject: r.subject,
      body: r.body,
      pdfPath: file ? path.resolve(dir, file) : "",
      pdfFileName: file,
      pdfUrlPath: r.pdfPath ?? "",
      mlsNumber: r.deal.property.mlsNumber,
      address: `${r.deal.property.address}, ${r.deal.property.city}`,
      offerPrice: r.deal.offerPrice,
      agentName: r.deal.agent?.name ?? null,
    };
  });

  if (chosen.length) {
    await db.outboxItem.updateMany({
      where: { id: { in: chosen.map((c) => c.id) } },
      data: { batchId, exportedAt: now },
    });
  }

  return {
    schemaVersion: 1,
    batchId,
    generatedAt: now.toISOString(),
    from: { name: settings?.buyerSignatory ?? "", email: settings?.buyerEmail ?? "" },
    dailyCap: cap.cap,
    sentToday: cap.sentToday,
    count: items.length,
    skippedNoEmail,
    skippedByCap,
    note:
      "Each item = one email: send `body` (plain text) to `to` with subject `subject`, attaching the PDF at `pdfPath`. " +
      "After sending, import this same file (or a file with {\"dealIds\": [...]}) via Outbox > 'Mark batch sent'. " +
      "An item may carry \"status\": \"failed\" to be left unsent.",
    items,
  };
}

export type BatchSentResult = {
  marked: string[];
  alreadySent: string[];
  notFound: string[];
  skippedFailed: string[];
  overCapWarning: string | null;
};

/** Accepts {dealIds:[]}, {items:[{dealId,status?,sentAt?}]} (outbox-batch.json), or a bare array of deal ids. */
export function extractBatchEntries(
  input: unknown
): { batchId?: string; entries: { dealId: string; outboxId?: string; failed: boolean; sentAt?: Date }[] } {
  const entries: { dealId: string; outboxId?: string; failed: boolean; sentAt?: Date }[] = [];
  let batchId: string | undefined;
  const push = (v: unknown) => {
    if (typeof v === "string") entries.push({ dealId: v, failed: false });
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.dealId !== "string") return;
      const status = typeof o.status === "string" ? o.status.toLowerCase() : "";
      const failed =
        o.sent === false || ["failed", "error", "skipped", "unsent"].includes(status);
      const sentAt = typeof o.sentAt === "string" && !isNaN(Date.parse(o.sentAt)) ? new Date(o.sentAt) : undefined;
      entries.push({
        dealId: o.dealId,
        outboxId: typeof o.outboxId === "string" ? o.outboxId : undefined,
        failed,
        sentAt,
      });
    }
  };
  if (Array.isArray(input)) input.forEach(push);
  else if (input && typeof input === "object") {
    const o = input as Record<string, unknown>;
    if (typeof o.batchId === "string") batchId = o.batchId;
    if (Array.isArray(o.items)) o.items.forEach(push);
    if (Array.isArray(o.dealIds)) o.dealIds.forEach(push);
  }
  return { batchId, entries };
}

export async function markBatchSent(db: Db, input: unknown): Promise<BatchSentResult> {
  const { batchId, entries } = extractBatchEntries(input);
  const result: BatchSentResult = {
    marked: [],
    alreadySent: [],
    notFound: [],
    skippedFailed: [],
    overCapWarning: null,
  };
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.dealId)) continue;
    seen.add(e.dealId);
    if (e.failed) {
      result.skippedFailed.push(e.dealId);
      continue;
    }
    const item = await db.outboxItem.findFirst({
      where: {
        dealId: e.dealId,
        ...(e.outboxId ? { id: e.outboxId } : {}),
        status: { in: ["ready", "sent"] },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    // prefer an item from the named batch if present
    const chosen =
      item ??
      (batchId
        ? await db.outboxItem.findFirst({ where: { dealId: e.dealId, batchId } })
        : null);
    if (!chosen) {
      result.notFound.push(e.dealId);
      continue;
    }
    if (chosen.status === "sent") {
      result.alreadySent.push(e.dealId);
      continue;
    }
    const r = await markOutboxSent(db, chosen.id, { sentAt: e.sentAt, via: "batch" });
    if (r.ok) result.marked.push(e.dealId);
    else result.notFound.push(e.dealId);
  }
  const cap = await getSendCapStatus(db);
  if (cap.sentToday > cap.cap) {
    result.overCapWarning = `Sent today (${cap.sentToday}) exceeds the daily cap (${cap.cap}).`;
  }
  return result;
}
