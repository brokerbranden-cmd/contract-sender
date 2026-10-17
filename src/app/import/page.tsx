"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IMPORT_FIELDS, type ColumnMapping, type ImportFieldKey } from "@/lib/import-fields";
import { formatCurrency } from "@/lib/utils";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

type Parsed = {
  filename: string;
  headers: string[];
  rows: string[][];
  total: number;
  mapping: ColumnMapping;
  missing: string[];
};

type RowResult = {
  row: number;
  action: "create" | "update" | "skip";
  reason?: string;
  address: string;
  city: string;
  zip: string;
  mlsNumber: string;
  listPrice: number | null;
  status: string;
  agentName: string;
  agentEmail: string;
  missingAgentEmail: boolean;
};

type Summary = {
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  missingAgentEmail: number;
  agentsCreated: number;
  agentsUpdated: number;
  dealsCreated: number;
  rows: RowResult[];
  rowsTruncated?: boolean;
  skippedRows: { row: number; reason: string }[];
};

const actionColor = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-sky-100 text-sky-700",
  skip: "bg-red-100 text-red-700",
};

export default function ImportPage() {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<Summary | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setPreview(null);
    setResult(null);
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/parse", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Upload failed");
      setParsed(null);
      return;
    }
    setParsed(data);
    setMapping(data.mapping);
    await runPreview(data, data.mapping);
  }

  async function runPreview(p: Parsed | null = parsed, m: ColumnMapping = mapping) {
    if (!p) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: p.rows, mapping: m, dryRun: true }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setPreview(null);
      setError(data.error || "Preview failed");
      return;
    }
    setPreview(data);
  }

  async function commit() {
    if (!parsed) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: parsed.rows,
        mapping,
        dryRun: false,
        filename: parsed.filename,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Import failed");
      return;
    }
    setResult(data);
    setPreview(null);
  }

  function setMap(key: ImportFieldKey, value: string) {
    const next = { ...mapping, [key]: value === "" ? null : Number(value) };
    setMapping(next);
    setPreview(null);
  }

  const mappedCount = Object.values(mapping).filter((v) => v != null).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MLS Import</h1>
        <p className="text-sm text-slate-500">
          Upload a Matrix / Reifax / generic CSV or Excel export. Properties upsert by MLS#
          (fallback address + zip), agents by email (fallback name + phone), and each new
          property gets a Deal at stage <code>new</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Upload file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block text-sm"
          />
          <p className="text-xs text-slate-500">
            No export handy?{" "}
            <a className="text-sky-600 underline" href="/sample-mls-listings.csv" download>
              Download the sample CSV
            </a>{" "}
            (fictional example data — not real listings or agents).
          </p>
          {busy && <p className="text-sm text-slate-500">Working…</p>}
          {error && (
            <p className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {parsed && !result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                2. Column mapping — {parsed.filename} ({parsed.total} rows, {mappedCount} columns
                mapped)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-slate-500">
                Columns were auto-detected. Fix anything wrong; leave “— not mapped —” to ignore a
                field. Address is required (or street number + street name).
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {IMPORT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      {f.label}
                      {f.required && <span className="text-red-500"> *</span>}
                    </label>
                    <Select
                      value={mapping[f.key] == null ? "" : String(mapping[f.key])}
                      onChange={(e) => setMap(f.key, e.target.value)}
                    >
                      <option value="">— not mapped —</option>
                      {parsed.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `(column ${i + 1})`}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button variant="outline" onClick={() => runPreview()} disabled={busy}>
                  Refresh preview
                </Button>
              </div>
            </CardContent>
          </Card>

          {preview && (
            <Card>
              <CardHeader>
                <CardTitle>3. Preview (nothing saved yet)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SummaryStats s={preview} future />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="p-2">Row</th>
                        <th className="p-2">Action</th>
                        <th className="p-2">MLS #</th>
                        <th className="p-2">Address</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">List price</th>
                        <th className="p-2">Agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 25).map((r) => (
                        <tr key={r.row} className="border-t border-slate-100">
                          <td className="p-2 text-slate-400">{r.row}</td>
                          <td className="p-2">
                            <Badge className={actionColor[r.action]}>{r.action}</Badge>
                            {r.reason && (
                              <span className="ml-2 text-xs text-red-600">{r.reason}</span>
                            )}
                          </td>
                          <td className="p-2">{r.mlsNumber || "—"}</td>
                          <td className="p-2">
                            {r.address}
                            <div className="text-xs text-slate-500">
                              {r.city} {r.zip}
                            </div>
                          </td>
                          <td className="p-2">{r.status || "—"}</td>
                          <td className="p-2">{formatCurrency(r.listPrice)}</td>
                          <td className="p-2">
                            {r.agentName || "—"}
                            <div
                              className={
                                r.missingAgentEmail ? "text-xs text-amber-600" : "text-xs text-slate-500"
                              }
                            >
                              {r.agentEmail || "no email"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-slate-500">
                    Showing the first 25 of {preview.totalRows} rows.
                  </p>
                </div>
                <Button onClick={commit} disabled={busy || preview.created + preview.updated === 0}>
                  <Upload className="h-4 w-4" /> Import {preview.created + preview.updated} listings
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Import complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryStats s={result} />
            {result.skippedRows.length > 0 && (
              <div className="text-sm">
                <div className="font-medium">Skipped rows</div>
                <ul className="list-disc pl-5 text-slate-600">
                  {result.skippedRows.slice(0, 20).map((s) => (
                    <li key={s.row}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Link href="/listings">
                <Button>Search listings</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setParsed(null);
                  setResult(null);
                }}
              >
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-2">
      <div className={`text-xl font-semibold ${warn && value > 0 ? "text-amber-600" : ""}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function SummaryStats({ s, future }: { s: Summary; future?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Stat label={future ? "will create" : "created"} value={s.created} />
      <Stat label={future ? "will update" : "updated"} value={s.updated} />
      <Stat label="skipped" value={s.skipped} warn />
      <Stat label="rows missing agent email" value={s.missingAgentEmail} warn />
      <Stat label={future ? "agents to create" : "agents created"} value={s.agentsCreated} />
      <Stat label={future ? "agents to update" : "agents updated"} value={s.agentsUpdated} />
      <Stat label={future ? "deals to create" : "deals created"} value={s.dealsCreated} />
    </div>
  );
}
