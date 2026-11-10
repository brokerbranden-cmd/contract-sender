"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, int, usd } from "@/lib/parcels/format";
import { COUNTIES } from "@/lib/parcels/counties";
import { ArrowLeft, ExternalLink, FilePlus2, FolderPlus } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TABS = ["Details", "Owner", "Sales History", "Mortgage", "Comparables"] as const;
type Tab = (typeof TABS)[number];

const money = (v: number | null | undefined) => (v == null ? "—" : usd.format(v));
const num = (v: number | null | undefined) => (v == null || v === 0 ? "—" : int.format(v));

function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-sm">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right font-medium text-slate-900">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ParcelPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("Details");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/parcels/${encodeURIComponent(params.id)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        setD(j);
      })
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <div className="rounded-md bg-red-50 p-4 text-red-700">{err}</div>;
  if (!d) return <div className="p-6 text-slate-500">Loading…</div>;
  const p = d.parcel;

  async function makeOffer() {
    setBusy("offer");
    const r = await fetch(`/api/parcels/${encodeURIComponent(p.id)}`, { method: "POST" });
    const j = await r.json();
    if (r.ok) router.push(`/deals/${j.dealId}`);
    else {
      setMsg(j.error || "Failed");
      setBusy("");
    }
  }
  async function followUp() {
    setBusy("follow");
    const r = await fetch("/api/parcels/follow-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [p.id], mode: "deals" }) });
    const j = await r.json();
    setBusy("");
    if (r.ok) {
      setMsg(j.created ? "Added to Follow Up." : "Already in Follow Up.");
      setD({ ...d, dealId: j.items[0].dealId });
    } else setMsg(j.error || "Failed");
  }

  const countyName = COUNTIES.find((c) => c.slug === p.county)?.name ?? p.county;
  const fullMailing = [p.ownerAddr1, p.ownerAddr2, [p.ownerCity, p.ownerState].filter(Boolean).join(", "), p.ownerZip].filter(Boolean).join(" · ");
  const yearsOwned = p.lastSaleDate ? Math.max(0, (Date.now() - new Date(p.lastSaleDate).getTime()) / 3.15576e10) : null;

  return (
    <div className="space-y-4">
      <Link href="/search" className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to search
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{p.situsAddress || `Folio ${p.parcelId}`}</h1>
          <div className="text-slate-600">
            {[p.situsCity, "FL", p.situsZip].filter(Boolean).join(" ")} · {countyName} County · Folio {p.parcelId}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-slate-100 px-2 py-0.5">{p.propertyType}</span>
            {p.homestead && <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">Homestead</span>}
            {p.absentee && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Absentee owner</span>}
            {p.outOfState && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Out-of-state owner</span>}
            {d.mls && <Link href="/listings" className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">On MLS · {d.mls.status ?? "listed"} {d.mls.listPrice ? money(d.mls.listPrice) : ""}</Link>}
            {d.dealId && <Link href={`/deals/${d.dealId}`} className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-800">In Follow Up →</Link>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={makeOffer} disabled={!!busy}>
            <FilePlus2 className="mr-1 h-4 w-4" /> Make offer
          </Button>
          <Button variant="outline" onClick={followUp} disabled={!!busy || !!d.dealId}>
            <FolderPlus className="mr-1 h-4 w-4" /> {d.dealId ? "In Follow Up" : "Add to Follow Up"}
          </Button>
        </div>
      </div>
      {msg && <div className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">{msg}</div>}

      {/* summary tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {[
          ["Market (just) value", money(p.justValue)],
          ["Assessed", money(p.assessedValue)],
          ["Last sale", p.lastSalePrice ? `${money(p.lastSalePrice)} · ${fmtDate(p.lastSaleDate)}` : "—"],
          ["Living area", p.livingArea ? `${num(p.livingArea)} sqft` : "—"],
          ["Beds / Baths", p.beds != null ? `${p.beds} / ${p.baths ?? "—"}` : "—"],
          ["Est. equity", p.estEquity != null ? `${money(p.estEquity)} (${Math.round(p.estEquityPct)}%)` : "—"],
        ].map(([k, v]) => (
          <Card key={k as string}>
            <CardContent className="p-3">
              <div className="text-xs text-slate-500">{k}</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t}
            {t === "Comparables" && d.comps.length ? ` (${d.comps.length})` : ""}
            {t === "Sales History" && d.sales.length ? ` (${d.sales.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Details" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Public record</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <KV
              items={[
                ["Property type", p.propertyType],
                ["DOR use code", p.useCode],
                ["Folio #", p.parcelId],
                ["County", countyName],
                ["Built", p.yearBuilt ?? "—"],
                ["Effective year built", p.effYearBuilt ?? "—"],
                ["Living area (LArea)", p.livingArea ? `${num(p.livingArea)} sqft` : "—"],
                ["Gross area (GArea)", p.grossArea ? `${num(p.grossArea)} sqft` : "—"],
                ["Lot size", p.lotSqft ? `${num(p.lotSqft)} sqft` : "—"],
                ["Beds", p.beds ?? "—"],
                ["Baths", p.baths ?? "—"],
                ["Stories", p.stories ?? "—"],
                ["Units", p.units ?? "—"],
                ["Buildings", p.buildings ?? "—"],
                ["Land value", money(p.landValue)],
                ["Build value", money(p.buildingValue)],
                ["Market (just) value", money(p.justValue)],
                ["Assessed value", money(p.assessedValue)],
                ["Taxable value", money(p.taxableValue)],
                ["$/Sqft (just value)", p.ppsf ? `$${Math.round(p.ppsf)}` : "—"],
                ["Homestead", p.homestead ? "Yes" : "No"],
                ["Assessment year", p.assessYear ?? "—"],
                ["Latitude", p.lat ?? "—"],
                ["Longitude", p.lon ?? "—"],
                ["Neighborhood code", p.neighborhood || "—"],
                ["Market area", p.marketArea || "—"],
                ["Township / Range / Section", [p.township, p.range, p.section].filter(Boolean).join(" / ") || "—"],
                ["Census block", p.censusBlock || "—"],
              ]}
            />
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Legal description</div>
              <div className="rounded bg-slate-50 p-3 font-mono text-xs text-slate-700">{p.legal || "—"}</div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {d.links.map((l: { label: string; url: string }) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                  {l.label} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
            <div className="text-xs text-slate-400">Source: Florida Department of Revenue {p.assessYear} tax roll (NAL){p.beds != null ? " + county Property Appraiser GIS" : ""}. Values are county assessments, not appraisals.</div>
          </CardContent>
        </Card>
      )}

      {tab === "Owner" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Owner information</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <KV
              items={[
                ["Owner name", p.ownerName || "—"],
                ["Mailing address", fullMailing || "—"],
                ["Absentee owner", p.absentee ? "Yes — mailing ≠ property address" : "No"],
                ["Out-of-state owner", p.outOfState ? `Yes (${p.ownerState})` : "No"],
                ["Homestead", p.homestead ? "Yes (likely owner-occupied)" : "No"],
                ["Years since last sale", yearsOwned != null ? yearsOwned.toFixed(1) : "—"],
                ["Phone / email", "Not in public records (skip trace)"],
              ]}
            />
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">
                Other properties with this exact owner name ({Math.max(0, d.sameOwnerCount - 1)} found across loaded counties)
              </div>
              {d.sameOwner.length === 0 ? (
                <div className="text-sm text-slate-500">None found.</div>
              ) : (
                <ul className="divide-y rounded border text-sm">
                  {d.sameOwner.map((o: any) => (
                    <li key={o.id} className="flex justify-between px-3 py-2">
                      <Link href={`/parcels/${encodeURIComponent(o.id)}`} className="text-sky-700 hover:underline">{o.situsAddress || o.id}, {o.situsCity}</Link>
                      <span className="text-slate-500">{o.propertyType} · {money(o.justValue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "Sales History" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sales history</CardTitle></CardHeader>
          <CardContent>
            {d.sales.length === 0 ? (
              <div className="text-sm text-slate-500">No sales on record in the loaded tax-roll files.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr><th className="p-2">Date</th><th className="p-2 text-right">Price</th><th className="p-2">Book</th><th className="p-2">Page</th><th className="p-2">CFN</th><th className="p-2">Qualified</th><th className="p-2">Source</th></tr>
                </thead>
                <tbody className="divide-y">
                  {d.sales.map((s: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">{fmtDate(s.date)}</td>
                      <td className="p-2 text-right tabular-nums">{money(s.price)}</td>
                      <td className="p-2">{s.book || "—"}</td><td className="p-2">{s.page || "—"}</td><td className="p-2">{s.cfn || "—"}</td>
                      <td className="p-2">{s.qualified == null ? "—" : s.qualified ? "Yes" : "No"}</td>
                      <td className="p-2 text-slate-500">{s.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-slate-400">The county files carry month-level dates and roughly the last two sales per parcel plus the most recent year of recorded sales; older transfers are on the clerk’s official records. Prices of $100 or less are usually non-arm’s-length transfers.</p>
          </CardContent>
        </Card>
      )}

      {tab === "Mortgage" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Mortgage & liens</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-md bg-amber-50 p-3 text-amber-900">
              Mortgage, lender and lien details are recorded at the county clerk and are <b>not</b> in the free tax-roll data, so Reifax-style “Mtg Lender / Amount / Rate” fields are not filled here.
              Look the owner up on the clerk’s official-records site (links below).
            </div>
            <KV
              items={[
                ["Est. loan balance (assumed)", p.estEquity != null && p.justValue ? money(p.justValue - p.estEquity) : "—"],
                ["Est. equity (assumed)", p.estEquity != null ? `${money(p.estEquity)} (${Math.round(p.estEquityPct)}%)` : "—"],
                ["Assumption", "80% LTV, 30-yr fixed @ 6.5% from the last arm’s-length sale; free & clear if no sale in 30 yrs"],
              ]}
            />
            <div className="flex flex-wrap gap-3">
              {d.links.map((l: { label: string; url: string }) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                  {l.label} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "Comparables" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Comparable sales — {d.basis === "distance" ? "nearest recent qualified sales of similar size" : `same ZIP (${p.situsZip}), recent qualified sales of similar size`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.comps.length === 0 ? (
              <div className="text-sm text-slate-500">No comparable sales found in the last 2 years for this property type and size.</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-6 text-sm">
                  <div><span className="text-slate-500">Median sale $/sqft:</span> <b>{d.medianSalePpsf ? `$${Math.round(d.medianSalePpsf)}` : "—"}</b></div>
                  <div><span className="text-slate-500">Value estimate from comps:</span> <b>{money(d.compsValueEstimate)}</b>{p.livingArea ? "" : " (needs living area)"}</div>
                  <div><span className="text-slate-500">County market value:</span> <b>{money(p.justValue)}</b></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="border-b text-xs uppercase text-slate-500">
                      <tr><th className="p-2">Mi</th><th className="p-2">Address</th><th className="p-2">Zip</th><th className="p-2 text-right">LArea</th><th className="p-2 text-right">Beds</th><th className="p-2 text-right">Baths</th><th className="p-2 text-right">Built</th><th className="p-2">Sold</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">$/sqft</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {d.comps.map((c: any) => (
                        <tr key={c.id}>
                          <td className="p-2">{c.distanceMi ?? "—"}</td>
                          <td className="p-2"><Link href={`/parcels/${encodeURIComponent(c.id)}`} className="text-sky-700 hover:underline">{c.address}</Link></td>
                          <td className="p-2">{c.zip}</td>
                          <td className="p-2 text-right">{num(c.livingArea)}</td>
                          <td className="p-2 text-right">{c.beds ?? "—"}</td>
                          <td className="p-2 text-right">{c.baths ?? "—"}</td>
                          <td className="p-2 text-right">{c.yearBuilt ?? "—"}</td>
                          <td className="p-2">{fmtDate(c.lastSaleDate)}</td>
                          <td className="p-2 text-right tabular-nums">{money(c.lastSalePrice)}</td>
                          <td className="p-2 text-right">{c.salePpsf ? `$${c.salePpsf}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="text-xs text-slate-400">Active-listing, distressed and rental comps need MLS / foreclosure feeds; import your Matrix export under MLS Import to see listings next to these sold comps.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
