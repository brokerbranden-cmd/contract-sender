"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEAL_STAGES,
  formatCurrency,
  formatDate,
  stageColor,
  stageLabel,
} from "@/lib/utils";
import {
  FileText,
  Mail,
  Download,
  Save,
  ExternalLink,
} from "lucide-react";

type Deal = {
  id: string;
  title: string;
  stage: string;
  offerPrice: number | null;
  earnestMoney: number | null;
  closingDays: number | null;
  inspectionDays: number | null;
  financingType: string | null;
  contingencies: string | null;
  notes: string | null;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    mlsNumber: string | null;
    listPrice: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
  };
  agent: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    brokerage: string | null;
  } | null;
  contracts: {
    id: string;
    status: string;
    pdfPath: string | null;
    sentAt: string | null;
    createdAt: string;
    template: { name: string } | null;
  }[];
  activities: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }[];
};

type Template = { id: string; name: string; isDefault: boolean };

export default function DealDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{
    to: string;
    subject: string;
    body: string;
    pdfPath: string | null;
    mailto: string | null;
  } | null>(null);
  const [form, setForm] = useState({
    offerPrice: "",
    earnestMoney: "",
    closingDays: "",
    inspectionDays: "",
    financingType: "Cash",
    contingencies: "",
    notes: "",
    stage: "new",
  });

  const load = useCallback(async () => {
    const [d, t] = await Promise.all([
      fetch(`/api/deals/${id}`).then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]);
    setDeal(d);
    setTemplates(t);
    const def = t.find((x: Template) => x.isDefault) || t[0];
    if (def) setTemplateId(def.id);
    setForm({
      offerPrice: d.offerPrice?.toString() ?? "",
      earnestMoney: d.earnestMoney?.toString() ?? "",
      closingDays: d.closingDays?.toString() ?? "",
      inspectionDays: d.inspectionDays?.toString() ?? "",
      financingType: d.financingType ?? "Cash",
      contingencies: d.contingencies ?? "",
      notes: d.notes ?? "",
      stage: d.stage,
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerPrice: form.offerPrice ? Number(form.offerPrice) : null,
        earnestMoney: form.earnestMoney ? Number(form.earnestMoney) : null,
        closingDays: form.closingDays ? Number(form.closingDays) : null,
        inspectionDays: form.inspectionDays
          ? Number(form.inspectionDays)
          : null,
        financingType: form.financingType,
        contingencies: form.contingencies,
        notes: form.notes,
        stage: form.stage,
      }),
    });
    setBusy(false);
    await load();
  }

  async function generatePdf() {
    setBusy(true);
    // Save offer terms first
    await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerPrice: form.offerPrice ? Number(form.offerPrice) : null,
        earnestMoney: form.earnestMoney ? Number(form.earnestMoney) : null,
        closingDays: form.closingDays ? Number(form.closingDays) : null,
        inspectionDays: form.inspectionDays
          ? Number(form.inspectionDays)
          : null,
        financingType: form.financingType,
        contingencies: form.contingencies,
        notes: form.notes,
      }),
    });
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: id, templateId }),
    });
    setBusy(false);
    if (res.ok) await load();
    else alert("Failed to generate PDF");
  }

  async function markSent(contractId: string) {
    setBusy(true);
    const res = await fetch(`/api/contracts/${contractId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setEmailPreview({
        to: data.preview.to,
        subject: data.preview.subject,
        body: data.preview.body,
        pdfPath: data.preview.pdfPath,
        mailto: data.mailto,
      });
      await load();
    }
  }

  if (!deal) return <div className="text-slate-500">Loading deal…</div>;

  const latest = deal.contracts[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/deals" className="text-xs text-sky-600 hover:underline">
            ← Deals
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{deal.title}</h1>
          <p className="text-sm text-slate-500">
            {deal.property.address}, {deal.property.city}, {deal.property.state}{" "}
            {deal.property.zip}
            {deal.property.mlsNumber ? ` · MLS ${deal.property.mlsNumber}` : ""}
          </p>
        </div>
        <Badge className={`${stageColor(deal.stage)} text-sm`}>
          {stageLabel(deal.stage)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Offer terms</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveOffer} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Offer Price</Label>
                    <Input
                      type="number"
                      value={form.offerPrice}
                      onChange={(e) =>
                        setForm({ ...form, offerPrice: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Earnest Money</Label>
                    <Input
                      type="number"
                      value={form.earnestMoney}
                      onChange={(e) =>
                        setForm({ ...form, earnestMoney: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Closing Days</Label>
                    <Input
                      type="number"
                      value={form.closingDays}
                      onChange={(e) =>
                        setForm({ ...form, closingDays: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Inspection Days</Label>
                    <Input
                      type="number"
                      value={form.inspectionDays}
                      onChange={(e) =>
                        setForm({ ...form, inspectionDays: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Financing</Label>
                    <Select
                      value={form.financingType}
                      onChange={(e) =>
                        setForm({ ...form, financingType: e.target.value })
                      }
                    >
                      <option>Cash</option>
                      <option>Conventional</option>
                      <option>Hard Money</option>
                      <option>Seller Finance</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Stage</Label>
                    <Select
                      value={form.stage}
                      onChange={(e) =>
                        setForm({ ...form, stage: e.target.value })
                      }
                    >
                      {DEAL_STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Contingencies</Label>
                  <Textarea
                    value={form.contingencies}
                    onChange={(e) =>
                      setForm({ ...form, contingencies: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={busy}>
                  <Save className="h-4 w-4" /> Save offer
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contract flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <Label>Template</Label>
                  <Select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isDefault ? " (default)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button onClick={generatePdf} disabled={busy || !templateId}>
                  <FileText className="h-4 w-4" />
                  {busy ? "Working…" : "Generate PDF"}
                </Button>
              </div>

              {latest && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {latest.template?.name ?? "Contract"} ·{" "}
                        <Badge className="bg-indigo-100 text-indigo-700">
                          {latest.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        Created {formatDate(latest.createdAt)}
                        {latest.sentAt
                          ? ` · Sent ${formatDate(latest.sentAt)}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {latest.pdfPath && (
                        <a href={latest.pdfPath} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" /> Download PDF
                          </Button>
                        </a>
                      )}
                      {latest.status !== "sent" && (
                        <Button
                          size="sm"
                          onClick={() => markSent(latest.id)}
                          disabled={busy}
                        >
                          <Mail className="h-4 w-4" /> Mark / Send Email
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {emailPreview && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mb-2 font-semibold text-emerald-900">
                    Email preview (MVP)
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-slate-500">To:</span>{" "}
                      {emailPreview.to || "(no agent email)"}
                    </div>
                    <div>
                      <span className="text-slate-500">Subject:</span>{" "}
                      {emailPreview.subject}
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-3 text-xs">
                      {emailPreview.body}
                    </pre>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {emailPreview.mailto && (
                      <a href={emailPreview.mailto}>
                        <Button size="sm">
                          <ExternalLink className="h-4 w-4" /> Open mailto
                        </Button>
                      </a>
                    )}
                    {emailPreview.pdfPath && (
                      <a
                        href={emailPreview.pdfPath}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" variant="outline">
                          Attach PDF manually
                        </Button>
                      </a>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {/* Resend hook: set RESEND_API_KEY and wire
                        /api/contracts/[id]/send to send via Resend with PDF attachment. */}
                    Tip: attach the PDF in your mail client. Resend API hook is
                    stubbed in the send route for later.
                  </p>
                </div>
              )}

              {deal.contracts.length > 1 && (
                <div className="text-xs text-slate-500">
                  {deal.contracts.length} contract versions on this deal
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="font-medium">
                {deal.property.address}
              </div>
              <div className="text-slate-500">
                {deal.property.city}, {deal.property.state} {deal.property.zip}
              </div>
              <div>List: {formatCurrency(deal.property.listPrice)}</div>
              <div>
                {deal.property.beds ?? "—"} bd · {deal.property.baths ?? "—"} ba
                · {deal.property.sqft ?? "—"} sqft
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Listing agent</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {deal.agent ? (
                <div className="space-y-1">
                  <div className="font-medium">{deal.agent.name}</div>
                  <div className="text-slate-500">{deal.agent.brokerage}</div>
                  <div>{deal.agent.email}</div>
                  <div>{deal.agent.phone}</div>
                </div>
              ) : (
                <p className="text-slate-500">No agent attached</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deal.activities.map((a) => (
                <div
                  key={a.id}
                  className="border-l-2 border-sky-200 pl-3 text-sm"
                >
                  <div className="text-xs text-slate-400">
                    {formatDate(a.createdAt)} · {a.type}
                  </div>
                  <div>{a.message}</div>
                </div>
              ))}
              {deal.activities.length === 0 && (
                <p className="text-sm text-slate-500">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
