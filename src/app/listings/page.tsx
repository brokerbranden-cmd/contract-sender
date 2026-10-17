"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, stageColor, stageLabel } from "@/lib/utils";
import { OFFER_SELECTION_KEY } from "@/lib/offer-utils";
import { ArrowDown, ArrowUp, FilePlus2, X } from "lucide-react";

type Row = {
  id: string;
  mlsNumber: string | null;
  status: string | null;
  address: string;
  city: string;
  zip: string;
  county: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  dom: number | null;
  listDate: string | null;
  isReo: boolean;
  isShortSale: boolean;
  agent: { name: string; email: string | null } | null;
  deal: { id: string; stage: string } | null;
  offered: boolean;
};

const EMPTY = {
  q: "",
  status: "",
  county: "",
  city: "",
  zip: "",
  minPrice: "",
  maxPrice: "",
  minBeds: "",
  minBaths: "",
  type: "",
  maxDom: "",
  reo: false,
  shortSale: false,
  hasAgentEmail: false,
  notOffered: false,
};
type Filters = typeof EMPTY;


function toQuery(f: Filters) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === "" || v === false) continue;
    sp.set(k, v === true ? "1" : String(v));
  }
  return sp;
}

export default function ListingsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState("updatedAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<{ items: Row[]; total: number; pages: number } | null>(null);
  const [facets, setFacets] = useState<{ statuses: string[]; counties: string[]; cities: string[]; types: string[] }>({
    statuses: [],
    counties: [],
    cities: [],
    types: [],
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/listings/facets").then((r) => r.json()).then(setFacets);
  }, []);

  // debounce applying filters
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied(filters);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = toQuery(applied);
    sp.set("sort", sort);
    sp.set("dir", dir);
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    const res = await fetch(`/api/listings?${sp}`);
    setData(await res.json());
    setLoading(false);
  }, [applied, sort, dir, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function set<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters((f) => ({ ...f, [k]: v }));
  }

  function toggleSort(col: string) {
    if (sort === col) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(col);
      setDir("asc");
    }
    setPage(1);
  }

  const pageIds = useMemo(() => data?.items.map((i) => i.id) ?? [], [data]);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function togglePage() {
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPage) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  }

  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function selectAllFiltered() {
    const res = await fetch(`/api/listings/ids?${toQuery(applied)}`);
    const { ids } = await res.json();
    setSelected(new Set<string>(ids));
  }

  function createOffers() {
    const ids = Array.from(selected);
    sessionStorage.setItem(OFFER_SELECTION_KEY, JSON.stringify(ids));
    router.push("/offers/bulk");
  }

  function Th({ col, label, className = "" }: { col: string; label: string; className?: string }) {
    return (
      <th className={`cursor-pointer select-none p-2 ${className}`} onClick={() => toggleSort(col)}>
        <span className="inline-flex items-center gap-1">
          {label}
          {sort === col && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </span>
      </th>
    );
  }

  const check = (k: "reo" | "shortSale" | "hasAgentEmail" | "notOffered", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={filters[k]} onChange={(e) => set(k, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Listings</h1>
          <p className="text-sm text-slate-500">
            Search imported MLS listings, tick the ones you want, and create offers in bulk.{" "}
            <Link href="/import" className="text-sky-600 underline">
              Import more
            </Link>
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Search address, MLS#, agent, subdivision…"
              value={filters.q}
              onChange={(e) => set("q", e.target.value)}
              className="lg:col-span-2"
            />
            <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">Any status</option>
              {facets.statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select value={filters.type} onChange={(e) => set("type", e.target.value)}>
              <option value="">Any property type</option>
              {facets.types.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select value={filters.county} onChange={(e) => set("county", e.target.value)}>
              <option value="">Any county</option>
              {facets.counties.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input
              placeholder="City"
              list="city-options"
              value={filters.city}
              onChange={(e) => set("city", e.target.value)}
            />
            <datalist id="city-options">
              {facets.cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Input placeholder="Zip" value={filters.zip} onChange={(e) => set("zip", e.target.value)} />
            <Input placeholder="Max DOM" type="number" value={filters.maxDom} onChange={(e) => set("maxDom", e.target.value)} />
            <Input placeholder="Min price" type="number" value={filters.minPrice} onChange={(e) => set("minPrice", e.target.value)} />
            <Input placeholder="Max price" type="number" value={filters.maxPrice} onChange={(e) => set("maxPrice", e.target.value)} />
            <Input placeholder="Min beds" type="number" value={filters.minBeds} onChange={(e) => set("minBeds", e.target.value)} />
            <Input placeholder="Min baths" type="number" step="0.5" value={filters.minBaths} onChange={(e) => set("minBaths", e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {check("reo", "REO only")}
            {check("shortSale", "Short sale only")}
            {check("hasAgentEmail", "Has agent email")}
            {check("notOffered", "Not yet offered")}
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)}>
              <X className="h-3 w-3" /> Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-slate-600">
          {data ? `${data.total} listing${data.total === 1 ? "" : "s"} match` : "Loading…"}
          {loading && " …"}
          {selected.size > 0 && (
            <span className="ml-3 font-medium text-sky-700">{selected.size} selected</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && data.total > 0 && (
            <Button variant="outline" size="sm" onClick={selectAllFiltered}>
              Select all {data.total} filtered
            </Button>
          )}
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          )}
          <Button size="sm" disabled={selected.size === 0} onClick={createOffers}>
            <FilePlus2 className="h-4 w-4" /> Create offers ({selected.size})
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-2">
                  <input type="checkbox" checked={allOnPage} onChange={togglePage} />
                </th>
                <Th col="address" label="Address" />
                <Th col="status" label="Status" />
                <Th col="listPrice" label="List price" />
                <Th col="beds" label="Bd" />
                <Th col="baths" label="Ba" />
                <Th col="sqft" label="SqFt" />
                <Th col="dom" label="DOM" />
                <th className="p-2">Flags</th>
                <th className="p-2">Agent</th>
                <th className="p-2">Deal</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((r) => (
                <tr key={r.id} className={`border-t border-slate-100 ${selected.has(r.id) ? "bg-sky-50" : ""}`}>
                  <td className="p-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{r.address}</div>
                    <div className="text-xs text-slate-500">
                      {r.city} {r.zip}
                      {r.county ? ` · ${r.county}` : ""}
                      {r.mlsNumber ? ` · ${r.mlsNumber}` : ""}
                    </div>
                  </td>
                  <td className="p-2">{r.status || "—"}</td>
                  <td className="p-2">{formatCurrency(r.listPrice)}</td>
                  <td className="p-2">{r.beds ?? "—"}</td>
                  <td className="p-2">{r.baths ?? "—"}</td>
                  <td className="p-2">{r.sqft?.toLocaleString() ?? "—"}</td>
                  <td className="p-2" title={r.listDate ? `Listed ${formatDate(r.listDate)}` : ""}>
                    {r.dom ?? "—"}
                  </td>
                  <td className="space-x-1 p-2">
                    {r.isReo && <Badge className="bg-orange-100 text-orange-700">REO</Badge>}
                    {r.isShortSale && <Badge className="bg-yellow-100 text-yellow-800">SS</Badge>}
                  </td>
                  <td className="p-2">
                    {r.agent ? (
                      <>
                        <div>{r.agent.name}</div>
                        <div className={`text-xs ${r.agent.email ? "text-slate-500" : "text-amber-600"}`}>
                          {r.agent.email || "no email"}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    {r.deal ? (
                      <Link href={`/deals/${r.deal.id}`}>
                        <Badge className={stageColor(r.deal.stage)}>{stageLabel(r.deal.stage)}</Badge>
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">
                    No listings match. <Link href="/import" className="text-sky-600 underline">Import an MLS export</Link>{" "}
                    or loosen the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {data && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            Rows per page
            <Select
              className="w-20"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </Button>
            <span>
              Page {page} of {data.pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
