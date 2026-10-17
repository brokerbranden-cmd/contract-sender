"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { buildMailto } from "@/lib/offer-utils";
import { Download, ExternalLink, FileText, Mail, Check, FileUp, ChevronDown, ChevronRight } from "lucide-react";

type Item = {
  id: string;
  dealId: string;
  status: string;
  to: string;
  subject: string;
  body: string;
  pdfPath: string | null;
  batchId: string | null;
  exportedAt: string | null;
  sentAt: string | null;
  address: string;
  mlsNumber: string | null;
  offerPrice: number | null;
  agentName: string | null;
};

type Cap = { cap: number; sentToday: number; remaining: number; exportedPending: number; remainingForExport: number };

export default function OutboxPage() {
  const [tab, setTab] = useState<"ready" | "sent">("ready");
  const [items, setItems] = useState<Item[]>([]);
  const [cap, setCap] = useState<Cap | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [includeExported, setIncludeExported] = useState(false);
  const [ignoreCap, setIgnoreCap] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/outbox?status=${tab}`);
    const data = await res.json();
    setItems(data.items);
    setCap(data.cap);
    setSelected(new Set());
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function markSent(it: Item) {
    let force = false;
    if (cap && cap.remaining <= 0) {
      if (!confirm(`Daily send cap reached (${cap.sentToday}/${cap.cap}). Mark as sent anyway?`)) return;
      force = true;
    }
    const res = await fetch(`/api/outbox/${it.id}/sent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    const data = await res.json();
    if (!res.ok) setMessage(data.error || "Failed");
    else setMessage(`Marked sent: ${it.address}`);
    load();
  }

  async function remove(it: Item) {
    if (!confirm(`Remove this offer from the Outbox? (${it.address})`)) return;
    await fetch(`/api/outbox/${it.id}/cancel`, { method: "POST" });
    load();
  }

  async function save(it: Item, patch: Partial<{ to: string; subject: string; body: string }>) {
    await fetch(`/api/outbox/${it.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  function exportHref() {
    const sp = new URLSearchParams();
    if (selected.size) sp.set("ids", Array.from(selected).join(","));
    if (includeExported) sp.set("includeExported", "1");
    if (ignoreCap) sp.set("ignoreCap", "1");
    return `/api/outbox/export?${sp}`;
  }

  async function onBatchFile(file: File | undefined) {
    if (!file) return;
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setMessage("That file isn't valid JSON.");
      return;
    }
    const res = await fetch("/api/outbox/batch-sent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });
    const r = await res.json();
    if (!res.ok) {
      setMessage(r.error || "Failed");
      return;
    }
    setMessage(
      `Batch processed: ${r.marked.length} marked sent, ${r.alreadySent.length} already sent, ${r.notFound.length} not found, ${r.skippedFailed.length} left unsent (failed).` +
        (r.overCapWarning ? ` ⚠ ${r.overCapWarning}` : "")
    );
    load();
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const capPct = cap ? Math.min(100, Math.round((cap.sentToday / Math.max(1, cap.cap)) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Outbox</h1>
        <p className="text-sm text-slate-500">
          Ready offers: open each in your mail app (mailto) or export a batch for the external
          sender. Attach the PDF manually when using mailto.
        </p>
      </div>

      {cap && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 pt-4 text-sm">
            <div>
              <div className="font-medium">
                Sent today: {cap.sentToday} / {cap.cap}
                {cap.exportedPending > 0 && (
                  <span className="ml-2 text-slate-500">({cap.exportedPending} exported, awaiting confirmation)</span>
                )}
              </div>
              <div className="mt-1 h-2 w-56 overflow-hidden rounded bg-slate-100">
                <div className={`h-full ${capPct >= 100 ? "bg-red-500" : "bg-sky-500"}`} style={{ width: `${capPct}%` }} />
              </div>
            </div>
            <div className="text-slate-600">{cap.remaining} left today</div>
            <Link href="/settings" className="text-sky-600 underline">
              Change cap
            </Link>
          </CardContent>
        </Card>
      )}

      {message && (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{message}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={tab === "ready" ? "default" : "outline"} size="sm" onClick={() => setTab("ready")}>
          Ready to send
        </Button>
        <Button variant={tab === "sent" ? "default" : "outline"} size="sm" onClick={() => setTab("sent")}>
          Sent
        </Button>
      </div>

      {tab === "ready" && (
        <Card>
          <CardHeader>
            <CardTitle>Batch sending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <a href={exportHref()} download="outbox-batch.json" onClick={() => setTimeout(load, 1500)}>
                <Button size="sm">
                  <Download className="h-4 w-4" /> Export batch for sending
                  {selected.size ? ` (${selected.size} selected)` : ""}
                </Button>
              </a>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeExported} onChange={(e) => setIncludeExported(e.target.checked)} />
                include already-exported
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ignoreCap} onChange={(e) => setIgnoreCap(e.target.checked)} />
                ignore daily cap
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
                <FileUp className="h-4 w-4" /> Mark batch sent (choose outbox-batch.json)
                <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => onBatchFile(e.target.files?.[0])} />
              </label>
              <span className="text-xs text-slate-500">
                Export respects the daily cap and skips rows with no agent email. After the external
                sender finishes, upload the file here to mark those deals sent.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {tab === "ready" && <th className="w-8 p-2" />}
              <th className="w-8 p-2" />
              <th className="p-2">Property</th>
              <th className="p-2">Offer</th>
              <th className="p-2">To</th>
              <th className="p-2">{tab === "ready" ? "Actions" : "Sent"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const isOpen = open === it.id;
              return (
                <ItemRows key={it.id}>
                  <tr className="border-t border-slate-100 align-top">
                    {tab === "ready" && (
                      <td className="p-2">
                        <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                      </td>
                    )}
                    <td className="p-2">
                      <button onClick={() => setOpen(isOpen ? null : it.id)} className="text-slate-500">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="p-2">
                      <Link href={`/deals/${it.dealId}`} className="font-medium hover:underline">
                        {it.address}
                      </Link>
                      <div className="text-xs text-slate-500">{it.mlsNumber}</div>
                    </td>
                    <td className="p-2">{formatCurrency(it.offerPrice)}</td>
                    <td className="p-2">
                      {tab === "ready" ? (
                        <EmailCell value={it.to} onSave={(v) => save(it, { to: v })} />
                      ) : (
                        it.to
                      )}
                      {it.agentName && <div className="text-xs text-slate-500">{it.agentName}</div>}
                      {it.exportedAt && tab === "ready" && (
                        <Badge className="mt-1 bg-purple-100 text-purple-700">exported</Badge>
                      )}
                    </td>
                    <td className="p-2">
                      {tab === "ready" ? (
                        <div className="flex flex-wrap gap-2">
                          {it.to ? (
                            <a href={buildMailto(it.to, it.subject, it.body)}>
                              <Button size="sm" variant="outline">
                                <Mail className="h-4 w-4" /> Open in email
                              </Button>
                            </a>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700">add email →</Badge>
                          )}
                          {it.pdfPath && (
                            <a href={it.pdfPath} target="_blank">
                              <Button size="sm" variant="ghost">
                                <FileText className="h-4 w-4" /> PDF
                              </Button>
                            </a>
                          )}
                          <Button size="sm" onClick={() => markSent(it)}>
                            <Check className="h-4 w-4" /> Mark sent
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(it)}>
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {formatDate(it.sentAt)}
                          {it.pdfPath && (
                            <a href={it.pdfPath} target="_blank" className="text-sky-600">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50">
                      <td colSpan={tab === "ready" ? 6 : 5} className="space-y-2 p-3">
                        {tab === "ready" ? (
                          <SubjectBodyEditor it={it} onSave={(p) => save(it, p)} />
                        ) : (
                          <>
                            <div className="text-sm font-medium">{it.subject}</div>
                            <pre className="whitespace-pre-wrap text-xs text-slate-700">{it.body}</pre>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </ItemRows>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  {tab === "ready" ? (
                    <>
                      Nothing waiting. Pick listings in{" "}
                      <Link href="/listings" className="text-sky-600 underline">
                        Listings
                      </Link>{" "}
                      and create offers.
                    </>
                  ) : (
                    "Nothing sent yet."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ItemRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function EmailCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <Input
      className={`h-8 w-56 text-xs ${v ? "" : "border-amber-400"}`}
      placeholder="agent email"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
    />
  );
}

function SubjectBodyEditor({
  it,
  onSave,
}: {
  it: Item;
  onSave: (p: { subject: string; body: string }) => void;
}) {
  const [subject, setSubject] = useState(it.subject);
  const [body, setBody] = useState(it.body);
  return (
    <>
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      <Textarea className="min-h-[170px] font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
      <Button size="sm" variant="outline" onClick={() => onSave({ subject, body })}>
        Save changes
      </Button>
    </>
  );
}
