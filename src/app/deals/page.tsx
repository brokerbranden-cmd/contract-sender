"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEAL_STAGES,
  formatCurrency,
} from "@/lib/utils";
import { LayoutGrid, List, Plus } from "lucide-react";

type Deal = {
  id: string;
  title: string;
  stage: string;
  offerPrice: number | null;
  property: { address: string; city: string; listPrice: number | null };
  agent: { name: string } | null;
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const load = () =>
    fetch("/api/deals")
      .then((r) => r.json())
      .then(setDeals);

  useEffect(() => {
    load();
  }, []);

  async function moveStage(id: string, stage: string) {
    await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-sm text-slate-500">
            Pipeline board · drag stages via dropdown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="h-4 w-4" /> Kanban
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" /> List
          </Button>
          <Link href="/deals/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> New Deal
            </Button>
          </Link>
        </div>
      </div>

      {view === "list" ? (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-500">
                  <th className="p-3 font-medium">Title</th>
                  <th className="p-3 font-medium">Property</th>
                  <th className="p-3 font-medium">Agent</th>
                  <th className="p-3 font-medium">Offer</th>
                  <th className="p-3 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="p-3">
                      <Link
                        href={`/deals/${d.id}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="p-3">
                      {d.property.address}, {d.property.city}
                    </td>
                    <td className="p-3">{d.agent?.name ?? "—"}</td>
                    <td className="p-3">{formatCurrency(d.offerPrice)}</td>
                    <td className="p-3">
                      <select
                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                        value={d.stage}
                        onChange={(e) => moveStage(d.id, e.target.value)}
                      >
                        {DEAL_STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <div className="kanban-scroll flex gap-3 overflow-x-auto pb-4">
          {DEAL_STAGES.map((stage) => {
            const col = deals.filter((d) => d.stage === stage.id);
            return (
              <div
                key={stage.id}
                className="w-64 shrink-0 rounded-xl border border-slate-200 bg-slate-100/80"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {stage.label}
                  </span>
                  <Badge className={stage.color}>{col.length}</Badge>
                </div>
                <div className="space-y-2 p-2">
                  {col.map((d) => (
                    <Link key={d.id} href={`/deals/${d.id}`}>
                      <div className="mb-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-sky-300">
                        <div className="text-sm font-medium">{d.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {d.property.address}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            {formatCurrency(d.offerPrice)}
                          </span>
                          <span className="text-slate-400">
                            {d.agent?.name?.split(" ")[0] ?? "No agent"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {col.length === 0 && (
                    <div className="px-2 py-6 text-center text-xs text-slate-400">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
