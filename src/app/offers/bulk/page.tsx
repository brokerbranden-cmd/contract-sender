"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, interpolate } from "@/lib/utils";
import {
  EMAIL_PLACEHOLDERS,
  OFFER_SELECTION_KEY,
  buildEmailVars,
  roundOffer,
} from "@/lib/offer-utils";
import { ChevronDown, ChevronRight, FilePlus2, AlertTriangle } from "lucide-react";

type Listing = {
  id: string;
  mlsNumber: string | null;
  address: string;
  city: string;
  zip: string;
  listPrice: number | null;
  offered: boolean;
  agent: { name: string; email: string | null; phone: string | null; brokerage: string | null } | null;
};

type Settings = {
  buyerName: string;
  buyerEntity: string;
  buyerSignatory: string;
  buyerPhone: string;
  buyerEmail: string;
  defaultEarnest: number;
  defaultClosingDays: number;
  defaultInspectionDays: number;
  defaultOfferPct: number;
  emailSubjectTpl: string;
  emailBodyTpl: string;
  duplicateGuardDays: number;
};

type Template = { id: string; name: string; isDefault: boolean };

type RowState = {
  offerPrice: string;
  priceEdited: boolean;
  subject?: string; // overrides (rendered text)
  body?: string;
};

type Result = {
  propertyId: string;
  address: string;
  status: "created" | "skipped" | "error";
  reason?: string;
  warning?: string;
  pdfPath?: string;
};

export default function BulkOffersPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [pct, setPct] = useState(75);
  const [earnest, setEarnest] = useState(1000);
  const [closing, setClosing] = useState(30);
  const [inspection, setInspection] = useState(10);
  const [subjectTpl, setSubjectTpl] = useState("");
  const [bodyTpl, setBodyTpl] = useState("");
  const [allowDup, setAllowDup] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ results: Result[]; created: number; skipped: number; errors: number } | null>(null);

  useEffect(() => {
    (async () => {
      const ids: string[] = JSON.parse(sessionStorage.getItem(OFFER_SELECTION_KEY) || "[]");
      const [s, t, l] = await Promise.all([
        fetch("/api/settings").then((r) => r.json()),
        fetch("/api/templates").then((r) => r.json()),
        ids.length
          ? fetch("/api/listings/by-ids", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids }),
            }).then((r) => r.json())
          : Promise.resolve({ items: [] }),
      ]);
      setSettings(s);
      setTemplates(t);
      setTemplateId((t.find((x: Template) => x.isDefault) ?? t[0])?.id ?? "");
      setPct(s.defaultOfferPct ?? 75);
      setEarnest(s.defaultEarnest);
      setClosing(s.defaultClosingDays);
      setInspection(s.defaultInspectionDays);
      setSubjectTpl(s.emailSubjectTpl);
      setBodyTpl(s.emailBodyTpl);
      setListings(l.items);
      const init: Record<string, RowState> = {};
      for (const it of l.items as Listing[]) {
        init[it.id] = {
          offerPrice: String(roundOffer(it.listPrice, s.defaultOfferPct ?? 75) ?? ""),
          priceEdited: false,
        };
      }
      setRows(init);
      setLoaded(true);
    })();
  }, []);

  function applyPct(newPct: number) {
    setPct(newPct);
    setRows((r) => {
      const n = { ...r };
      for (const l of listings) {
        if (!n[l.id]?.priceEdited) {
          n[l.id] = { ...n[l.id], offerPrice: String(roundOffer(l.listPrice, newPct) ?? "") };
        }
      }
      return n;
    });
  }

  function resetAllToRule() {
    setRows((r) => {
      const n = { ...r };
      for (const l of listings) {
        n[l.id] = { ...n[l.id], offerPrice: String(roundOffer(l.listPrice, pct) ?? ""), priceEdited: false };
      }
      return n;
    });
  }

  function render(l: Listing) {
    if (!settings) return { subject: "", body: "" };
    const st = rows[l.id];
    const price = Number(st?.offerPrice) || null;
    const vars = buildEmailVars({
      settings,
      property: { address: l.address, city: l.city, zip: l.zip, mlsNumber: l.mlsNumber, listPrice: l.listPrice },
      agent: l.agent,
      offerPrice: price,
      earnestMoney: earnest,
      closingDays: closing,
      inspectionDays: inspection,
    });
    return {
      subject: st?.subject ?? interpolate(subjectTpl, vars),
      body: st?.body ?? interpolate(bodyTpl, vars),
    };
  }

  const stats = useMemo(() => {
    const noEmail = listings.filter((l) => !l.agent?.email).length;
    const noPrice = listings.filter((l) => !(Number(rows[l.id]?.offerPrice) > 0)).length;
    const already = listings.filter((l) => l.offered).length;
    const total = listings.reduce((s, l) => s + (Number(rows[l.id]?.offerPrice) || 0), 0);
    return { noEmail, noPrice, already, total };
  }, [listings, rows]);

  function patch(id: string, p: Partial<RowState>) {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));
  }

  function removeRow(id: string) {
    setListings((l) => l.filter((x) => x.id !== id));
  }

  async function submit() {
    if (!settings) return;
    setBusy(true);
    setError("");
    const items = listings.map((l) => {
      const { subject, body } = render(l);
      return {
        propertyId: l.id,
        offerPrice: Number(rows[l.id]?.offerPrice) || 0,
        subject,
        body,
      };
    });
    const res = await fetch("/api/offers/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        earnestMoney: earnest,
        closingDays: closing,
        inspectionDays: inspection,
        allowDuplicates: allowDup,
        items,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed to create offers");
      return;
    }
    setResults(data);
    sessionStorage.removeItem(OFFER_SELECTION_KEY);
  }

  if (!loaded) return <div className="text-slate-500">Loading…</div>;

  if (results) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Offers created</h1>
        <div className="flex gap-3 text-sm">
          <Badge className="bg-emerald-100 text-emerald-700">{results.created} created</Badge>
          <Badge className="bg-amber-100 text-amber-700">{results.skipped} skipped</Badge>
          <Badge className="bg-red-100 text-red-700">{results.errors} errors</Badge>
        </div>
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-left text-sm">
              <tbody>
                {results.results.map((r) => (
                  <tr key={r.propertyId} className="border-t border-slate-100">
                    <td className="p-2">{r.address}</td>
                    <td className="p-2">
                      <Badge
                        className={
                          r.status === "created"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.status === "skipped"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-slate-600">
                      {r.reason}
                      {r.warning && <span className="text-amber-600">{r.warning}</span>}
                    </td>
                    <td className="p-2">
                      {r.pdfPath && (
                        <a className="text-sky-600 underline" href={r.pdfPath} target="_blank">
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Link href="/outbox">
            <Button>Go to Outbox</Button>
          </Link>
          <Link href="/listings">
            <Button variant="outline">Back to listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Bulk offers</h1>
        <p className="text-slate-600">
          No listings selected. Go to{" "}
          <Link href="/listings" className="text-sky-600 underline">
            Listings
          </Link>
          , tick the properties you want to offer on, and click “Create offers”.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk offers</h1>
        <p className="text-sm text-slate-500">
          {listings.length} listing{listings.length === 1 ? "" : "s"} selected. Review and edit
          each offer, then generate PDFs and queue the emails in the Outbox. Nothing is emailed
          from here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Offer rule &amp; terms (As-Is, cash)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <Label>Contract template</Label>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Offer % of list price</Label>
            <Input type="number" step="0.5" value={pct} onChange={(e) => applyPct(Number(e.target.value))} />
          </div>
          <div>
            <Label>Earnest money ($)</Label>
            <Input type="number" value={earnest} onChange={(e) => setEarnest(Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Closing days</Label>
              <Input type="number" value={closing} onChange={(e) => setClosing(Number(e.target.value))} />
            </div>
            <div>
              <Label>Inspection</Label>
              <Input type="number" value={inspection} onChange={(e) => setInspection(Number(e.target.value))} />
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button variant="outline" size="sm" onClick={resetAllToRule}>
              Reset all offer prices to {pct}% (rounded to nearest $1,000)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email template (applies to every row you haven’t hand-edited)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Subject</Label>
            <Input value={subjectTpl} onChange={(e) => setSubjectTpl(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea className="min-h-[150px]" value={bodyTpl} onChange={(e) => setBodyTpl(e.target.value)} />
          </div>
          <p className="text-xs text-slate-500">
            Placeholders:{" "}
            {EMAIL_PLACEHOLDERS.map((p) => (
              <code key={p} className="mr-1">{`{{${p}}}`}</code>
            ))}
            (camelCase like {"{{offerPrice}}"} / {"{{agentName}}"} also work). Edit defaults permanently in Settings.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge className="bg-slate-100 text-slate-700">Total offered: {formatCurrency(stats.total)}</Badge>
        {stats.noEmail > 0 && (
          <Badge className="bg-amber-100 text-amber-700">{stats.noEmail} without agent email</Badge>
        )}
        {stats.noPrice > 0 && (
          <Badge className="bg-red-100 text-red-700">{stats.noPrice} without offer price (will be skipped)</Badge>
        )}
        {stats.already > 0 && (
          <Badge className="bg-amber-100 text-amber-700">{stats.already} already have an offer in progress</Badge>
        )}
        <label className="ml-auto flex items-center gap-2">
          <input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} />
          Override duplicate guard ({settings?.duplicateGuardDays} days)
        </label>
      </div>

      <Card>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-8 p-2" />
              <th className="p-2">Property</th>
              <th className="p-2">List price</th>
              <th className="p-2">Offer price</th>
              <th className="p-2">Agent</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => {
              const open = expanded === l.id;
              const pv = render(l);
              const st = rows[l.id];
              return (
                <RowBlock key={l.id}>
                  <tr className="border-t border-slate-100 align-top">
                    <td className="p-2">
                      <button onClick={() => setExpanded(open ? null : l.id)} className="text-slate-500">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{l.address}</div>
                      <div className="text-xs text-slate-500">
                        {l.city} {l.zip} {l.mlsNumber ? `· ${l.mlsNumber}` : ""}
                      </div>
                    </td>
                    <td className="p-2">{formatCurrency(l.listPrice)}</td>
                    <td className="p-2">
                      <Input
                        className="w-32"
                        type="number"
                        step={1000}
                        value={st?.offerPrice ?? ""}
                        onChange={(e) => patch(l.id, { offerPrice: e.target.value, priceEdited: true })}
                      />
                      {l.listPrice && Number(st?.offerPrice) > 0 && (
                        <div className="mt-1 text-xs text-slate-500">
                          {((Number(st.offerPrice) / l.listPrice) * 100).toFixed(1)}% of list
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {l.agent ? (
                        <>
                          <div>{l.agent.name}</div>
                          <div className={`text-xs ${l.agent.email ? "text-slate-500" : "text-amber-600"}`}>
                            {l.agent.email || "no email"}
                          </div>
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" /> no agent
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeRow(l.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-slate-50">
                      <td />
                      <td colSpan={5} className="space-y-2 p-3">
                        <div>
                          <Label>
                            Subject {st?.subject != null && <span className="text-amber-600">(edited)</span>}
                          </Label>
                          <Input value={pv.subject} onChange={(e) => patch(l.id, { subject: e.target.value })} />
                        </div>
                        <div>
                          <Label>
                            Body {st?.body != null && <span className="text-amber-600">(edited)</span>}
                          </Label>
                          <Textarea
                            className="min-h-[170px] font-mono text-xs"
                            value={pv.body}
                            onChange={(e) => patch(l.id, { body: e.target.value })}
                          />
                        </div>
                        {(st?.subject != null || st?.body != null) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => patch(l.id, { subject: undefined, body: undefined })}
                          >
                            Revert to template
                          </Button>
                        )}
                      </td>
                    </tr>
                  )}
                </RowBlock>
              );
            })}
          </tbody>
        </table>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy || listings.length === 0}>
          <FilePlus2 className="h-4 w-4" />
          {busy ? "Generating PDFs…" : `Generate ${listings.length} offer${listings.length === 1 ? "" : "s"} → Outbox`}
        </Button>
        <Link href="/listings">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}

function RowBlock({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
