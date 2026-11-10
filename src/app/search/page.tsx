"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { OFFER_SELECTION_KEY } from "@/lib/offer-utils";
import {
  COLUMNS,
  COLUMN_MAP,
  DEFAULT_COLUMNS,
  FIELDS,
  FILTER_GROUPS,
  FIELD_MAP,
  OPS_BY_TYPE,
  type ColumnDef,
  type Criterion,
  type FieldDef,
  type Op,
} from "@/lib/parcels/fields";
import { fmtCell } from "@/lib/parcels/format";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Columns3, Download, FilePlus2, FolderPlus, RotateCcw, Save, Search as SearchIcon, Trash2 } from "lucide-react";

type Row = Record<string, unknown> & { id: string; mls: { id: string; status: string | null } | null; dealId: string | null };
type Crit = { op: Op; value: string; value2: string };
type Saved = { id: string; name: string; criteria: Criterion[]; columns: string[] | null };
type Stats = { counties: { county: string; count: number; year: number | null; withGeo: number; withBeds: number }[]; total: number };

const COLS_KEY = "parcelSearchColumns";
const LAST_KEY = "parcelSearchLast";

function defaultOp(f: FieldDef): Op {
  return OPS_BY_TYPE[f.type][0].op;
}

function toCriteria(state: Record<string, Crit>): Criterion[] {
  const out: Criterion[] = [];
  for (const [field, c] of Object.entries(state)) {
    const f = FIELD_MAP[field];
    if (!f || f.stub) continue;
    const noValueOp = c.op === "empty" || c.op === "notEmpty";
    if (!noValueOp && c.value.trim() === "" && c.value2.trim() === "") continue;
    out.push({ field, op: c.op, value: c.value, value2: c.value2 });
  }
  return out;
}

function fromCriteria(list: Criterion[]): Record<string, Crit> {
  const s: Record<string, Crit> = {};
  for (const c of list) s[c.field] = { op: c.op, value: c.value ?? "", value2: c.value2 ?? "" };
  return s;
}

export default function ParcelSearchPage() {
  const router = useRouter();
  const [state, setState] = useState<Record<string, Crit>>({});
  const [applied, setApplied] = useState<Criterion[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({ Location: true, Property: true });
  const [sort, setSort] = useState("market");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [cols, setCols] = useState<string[]>(DEFAULT_COLUMNS);
  const [showCols, setShowCols] = useState(false);
  const [data, setData] = useState<{ items: Row[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState<{ ids: string[]; capped: boolean } | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  // restore columns + last search
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(COLS_KEY) || "null");
      if (Array.isArray(c) && c.length) setCols(c.filter((k: string) => COLUMN_MAP[k]));
      const last = JSON.parse(localStorage.getItem(LAST_KEY) || "null");
      if (last?.criteria) {
        setState(fromCriteria(last.criteria));
        setApplied(last.criteria);
      }
    } catch {}
    fetch("/api/saved-searches").then((r) => r.json()).then(setSaved).catch(() => {});
    fetch("/api/parcels/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const run = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/parcels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: applied, sort, dir, page, pageSize }),
      });
      const j = await r.json();
      if (id !== reqId.current) return;
      if (!r.ok) throw new Error(j.error || "Search failed");
      setData(j);
    } catch (e) {
      if (id === reqId.current) setError((e as Error).message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [applied, sort, dir, page, pageSize]);

  useEffect(() => {
    run();
  }, [run]);

  function applySearch() {
    const c = toCriteria(state);
    setApplied(c);
    setPage(1);
    setSelected(new Set());
    setAllMatching(null);
    localStorage.setItem(LAST_KEY, JSON.stringify({ criteria: c }));
  }

  function reset() {
    setState({});
    setApplied([]);
    setPage(1);
    setSelected(new Set());
    setAllMatching(null);
    localStorage.removeItem(LAST_KEY);
  }

  function setCrit(field: string, patch: Partial<Crit>) {
    const f = FIELD_MAP[field];
    setState((s) => ({ ...s, [field]: { ...(s[field] ?? { op: defaultOp(f), value: "", value2: "" }), ...patch } }));
  }

  function toggleSort(key: string) {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDir("asc");
    }
    setPage(1);
  }

  function toggleCol(key: string) {
    const next = cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key];
    setCols(next);
    localStorage.setItem(COLS_KEY, JSON.stringify(next));
  }

  const activeCount = useMemo(() => toCriteria(state).length, [state]);
  const visibleCols = useMemo(() => COLUMNS.filter((c) => cols.includes(c.key)), [cols]);
  const pageIds = data?.items.map((r) => r.id) ?? [];
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAllPage() {
    const next = new Set(selected);
    if (allOnPage) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    setSelected(next);
    setAllMatching(null);
  }

  async function selectAllMatching() {
    const r = await fetch("/api/parcels/ids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ criteria: applied }) });
    const j = await r.json();
    setSelected(new Set(j.ids));
    setAllMatching(j);
  }

  async function saveSearch() {
    const name = window.prompt("Name this saved search:");
    if (!name) return;
    const r = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, criteria: toCriteria(state), columns: cols }),
    });
    if (r.ok) {
      const list = await fetch("/api/saved-searches").then((x) => x.json());
      setSaved(list);
      setMsg(`Saved search “${name}”.`);
    }
  }

  function loadSaved(id: string) {
    const s = saved.find((x) => x.id === id);
    if (!s) return;
    setState(fromCriteria(s.criteria));
    setApplied(s.criteria);
    if (s.columns?.length) setCols(s.columns.filter((k) => COLUMN_MAP[k]));
    setPage(1);
    setSelected(new Set());
    setMsg(`Loaded “${s.name}”.`);
  }

  async function deleteSaved(id: string) {
    if (!window.confirm("Delete this saved search?")) return;
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    setSaved((l) => l.filter((x) => x.id !== id));
  }

  async function exportCsv(onlySelected: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/parcels/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: applied, sort, dir, ids: onlySelected ? Array.from(selected) : undefined }),
      });
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `parcel-search-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  }

  async function addToFollowUp() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/parcels/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), mode: "deals" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(`Added ${j.created} to Follow Up (deals)${j.existing ? `, ${j.existing} already existed` : ""}.`);
      run();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function makeOffers() {
    setBusy(true);
    try {
      const r = await fetch("/api/parcels/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), mode: "properties" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      sessionStorage.setItem(OFFER_SELECTION_KEY, JSON.stringify(j.items.map((i: { propertyId: string }) => i.propertyId)));
      router.push("/offers/bulk");
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  const total = stats?.total ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Property Search</h1>
          <p className="text-sm text-slate-500">
            Public-records search (county tax rolls) — find owners, filter by value, equity, absentee and more, then send to Follow Up or bulk offers.
          </p>
        </div>
        {stats && (
          <div className="text-right text-xs text-slate-500">
            {total ? (
              <>
                <div className="font-medium text-slate-700">{total.toLocaleString()} parcels loaded</div>
                <div>{stats.counties.map((c) => `${c.county} ${c.count.toLocaleString()}`).join(" · ")}</div>
              </>
            ) : (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
                No parcel data yet. In the project folder run <code className="font-mono">npm run data:import -- --county miami-dade</code>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* ---------------- filter panel ---------------- */}
        <Card className="h-fit max-h-[calc(100vh-7rem)] overflow-y-auto lg:sticky lg:top-4">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white p-3">
            <Button size="sm" onClick={applySearch}>
              <SearchIcon className="mr-1 h-4 w-4" /> Search{activeCount ? ` (${activeCount})` : ""}
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reset
            </Button>
            <Button size="sm" variant="outline" onClick={saveSearch} title="Save this search">
              <Save className="h-4 w-4" />
            </Button>
          </div>
          <div className="border-b p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Saved searches</div>
            {saved.length === 0 ? (
              <div className="text-xs text-slate-400">None yet — set filters and click the save icon.</div>
            ) : (
              <div className="space-y-1">
                {saved.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <button className="truncate text-left text-sky-700 hover:underline" onClick={() => loadSaved(s.id)}>
                      {s.name}
                    </button>
                    <button className="text-slate-400 hover:text-red-600" onClick={() => deleteSaved(s.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {FILTER_GROUPS.map((g) => {
            const fields = FIELDS.filter((f) => f.group === g);
            const activeInGroup = fields.filter((f) => toCriteria({ [f.key]: state[f.key] ?? { op: defaultOp(f), value: "", value2: "" } }).length > 0).length;
            const isOpen = open[g];
            return (
              <div key={g} className="border-b last:border-0">
                <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50" onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}>
                  <span className="flex items-center gap-1">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {g}
                  </span>
                  {activeInGroup > 0 && <span className="rounded-full bg-sky-100 px-2 text-xs text-sky-700">{activeInGroup}</span>}
                </button>
                {isOpen && (
                  <div className="space-y-3 px-3 pb-3">
                    {fields.map((f) => (
                      <FieldRow key={f.key} f={f} c={state[f.key]} onChange={(p) => setCrit(f.key, p)} onEnter={applySearch} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        {/* ---------------- results ---------------- */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 text-sm text-slate-600">
              {loading ? "Searching…" : data ? <><b className="text-slate-900">{data.total.toLocaleString()}</b> properties</> : ""}
            </div>
            <Button size="sm" variant="outline" disabled={!selected.size || busy} onClick={addToFollowUp}>
              <FolderPlus className="mr-1 h-4 w-4" /> Add to Follow Up ({selected.size})
            </Button>
            <Button size="sm" disabled={!selected.size || busy} onClick={makeOffers}>
              <FilePlus2 className="mr-1 h-4 w-4" /> Bulk offers ({selected.size})
            </Button>
            <Button size="sm" variant="outline" disabled={busy || !data?.total} onClick={() => exportCsv(selected.size > 0)}>
              <Download className="mr-1 h-4 w-4" /> CSV{selected.size ? " (selected)" : ""}
            </Button>
            <div className="relative">
              <Button size="sm" variant="outline" onClick={() => setShowCols((v) => !v)}>
                <Columns3 className="mr-1 h-4 w-4" /> Columns
              </Button>
              {showCols && (
                <div className="absolute right-0 z-20 mt-1 grid w-72 grid-cols-2 gap-1 rounded-md border bg-white p-3 text-sm shadow-lg">
                  {COLUMNS.map((c) => (
                    <label key={c.key} className="flex items-center gap-2">
                      <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} />
                      {c.label}
                    </label>
                  ))}
                  <button className="col-span-2 mt-1 text-left text-xs text-sky-700 hover:underline" onClick={() => { setCols(DEFAULT_COLUMNS); localStorage.removeItem(COLS_KEY); }}>
                    Reset to Reifax defaults
                  </button>
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-slate-500">Rows</span>
              <Select className="w-20" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {[50, 100, 250].map((n) => <option key={n}>{n}</option>)}
              </Select>
            </div>
          </div>

          {msg && <div className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">{msg}</div>}
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {data && allOnPage && data.total > pageIds.length && !allMatching && (
            <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              All {pageIds.length} on this page selected.{" "}
              <button className="font-medium text-sky-700 hover:underline" onClick={selectAllMatching}>
                Select all {Math.min(data.total, 5000).toLocaleString()} matching{data.total > 5000 ? " (max 5,000)" : ""}
              </button>
            </div>
          )}
          {allMatching && (
            <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {allMatching.ids.length.toLocaleString()} properties selected{allMatching.capped ? " (capped at 5,000)" : ""}.{" "}
              <button className="font-medium text-sky-700 hover:underline" onClick={() => { setSelected(new Set()); setAllMatching(null); }}>Clear</button>
            </div>
          )}

          <Card className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-8 p-2"><input type="checkbox" checked={allOnPage} onChange={toggleAllPage} /></th>
                  <th className="w-12 p-2" title="MLS listing / existing deal">S</th>
                  {visibleCols.map((c) => (
                    <th key={c.key} className={`cursor-pointer select-none whitespace-nowrap p-2 ${c.align === "right" ? "text-right" : ""}`} onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort === c.key && (dir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.items.map((r) => (
                  <tr key={r.id} className={`hover:bg-sky-50/50 ${selected.has(r.id) ? "bg-sky-50" : ""}`}>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => {
                          const n = new Set(selected);
                          if (n.has(r.id)) n.delete(r.id);
                          else n.add(r.id);
                          setSelected(n);
                          setAllMatching(null);
                        }}
                      />
                    </td>
                    <td className="whitespace-nowrap p-2 text-xs">
                      {r.mls && <span className="rounded bg-emerald-100 px-1 py-0.5 text-emerald-700" title={`MLS: ${r.mls.status ?? ""}`}>MLS</span>}{" "}
                      {r.dealId && <Link href={`/deals/${r.dealId}`} className="rounded bg-indigo-100 px-1 py-0.5 text-indigo-700" title="Open deal">F</Link>}
                    </td>
                    {visibleCols.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap p-2 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.key === "owner" ? "max-w-[220px] truncate" : ""}`}>
                        {c.key === "address" ? (
                          <Link href={`/parcels/${encodeURIComponent(r.id)}`} className="font-medium text-sky-700 hover:underline">
                            {String(r.situsAddress || "—")}
                          </Link>
                        ) : (
                          fmtCell(c as ColumnDef, r[c.prop])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {data && data.items.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length + 2} className="p-8 text-center text-slate-500">
                      {data.total === 0 && total === 0 ? "No parcel data loaded yet — run the data import (see top right)." : "No properties match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          {data && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <div>
                Page {page} of {data.pages.toLocaleString()}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(1)}>« First</Button>
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</Button>
                <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next ›</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ f, c, onChange, onEnter }: { f: FieldDef; c?: Crit; onChange: (p: Partial<Crit>) => void; onEnter: () => void }) {
  const ops = OPS_BY_TYPE[f.type];
  const cur: Crit = c ?? { op: ops[0].op, value: "", value2: "" };
  const noVal = cur.op === "empty" || cur.op === "notEmpty";
  const active = !f.stub && (noVal ? !!c : cur.value.trim() !== "" || cur.value2.trim() !== "");
  const key = (e: React.KeyboardEvent) => e.key === "Enter" && onEnter();

  return (
    <div className={`rounded-md p-1.5 ${active ? "bg-sky-50 ring-1 ring-sky-200" : ""} ${f.stub ? "opacity-60" : ""}`} title={f.hint}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-700">
        <span>{f.label}</span>
        {f.stub && <span className="rounded bg-slate-200 px-1.5 text-[10px] font-normal text-slate-600">needs data</span>}
      </div>
      {f.stub ? (
        <div className="text-[11px] text-slate-500">{f.note}</div>
      ) : f.type === "bool" ? (
        <Select className="h-8" value={cur.value || ""} onChange={(e) => onChange({ op: "is", value: e.target.value })}>
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      ) : f.type === "enum" ? (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {f.options?.map((o) => {
              const vals = cur.value ? cur.value.split(",") : [];
              const on = vals.includes(o.value);
              return (
                <label key={o.value} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = on ? vals.filter((v) => v !== o.value) : [...vals, o.value];
                      onChange({ op: cur.op === "notIn" ? "notIn" : "in", value: next.join(",") });
                    }}
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          <Select className="h-8 w-[130px] shrink-0 px-2 text-xs" value={cur.op} onChange={(e) => onChange({ op: e.target.value as Op })}>
            {ops.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
          </Select>
          {!noVal && (
            <>
              <Input
                className="h-8 min-w-0 flex-1 px-2 text-xs"
                type={f.type === "date" ? "text" : "text"}
                placeholder={f.type === "date" ? "YYYY-MM-DD" : cur.op === "between" ? "from" : ""}
                value={cur.value}
                onChange={(e) => onChange({ value: e.target.value })}
                onKeyDown={key}
              />
              {cur.op === "between" && (
                <Input className="h-8 min-w-0 flex-1 px-2 text-xs" placeholder={f.type === "date" ? "YYYY-MM-DD" : "to"} value={cur.value2} onChange={(e) => onChange({ value2: e.target.value })} onKeyDown={key} />
              )}
            </>
          )}
        </div>
      )}
      {f.note && !f.stub && <div className="mt-0.5 text-[10px] text-slate-400">{f.note}</div>}
    </div>
  );
}
