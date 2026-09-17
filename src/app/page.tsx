"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDate,
  stageColor,
  stageLabel,
} from "@/lib/utils";
import {
  Handshake,
  Home,
  Users,
  DollarSign,
  ArrowRight,
} from "lucide-react";

type Dash = {
  stats: {
    activeDeals: number;
    totalDeals: number;
    properties: number;
    agents: number;
    pipelineValue: number;
  };
  byStage: { id: string; label: string; color: string; count: number }[];
  recentDeals: {
    id: string;
    title: string;
    stage: string;
    offerPrice: number | null;
    property: { address: string; city: string };
    agent: { name: string } | null;
  }[];
  recentActivities: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
    deal: { id: string; title: string };
  }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <div className="text-slate-500">Loading dashboard…</div>;
  }

  const tiles = [
    {
      label: "Active Deals",
      value: data.stats.activeDeals,
      icon: Handshake,
      href: "/deals",
    },
    {
      label: "Pipeline Value",
      value: formatCurrency(data.stats.pipelineValue),
      icon: DollarSign,
      href: "/deals",
    },
    {
      label: "Properties",
      value: data.stats.properties,
      icon: Home,
      href: "/properties",
    },
    {
      label: "Agents",
      value: data.stats.agents,
      icon: Users,
      href: "/agents",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Florida investor pipeline overview
          </p>
        </div>
        <Link
          href="/deals/new"
          className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          New Deal <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="transition hover:border-sky-300">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-sky-50 p-3 text-sky-600">
                  <t.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t.label}</div>
                  <div className="text-xl font-semibold">{t.value}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline by stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.byStage.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="text-xs text-slate-500">{s.label}</div>
                  <div className="text-2xl font-bold">{s.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivities.length === 0 && (
              <p className="text-sm text-slate-500">No activity yet.</p>
            )}
            {data.recentActivities.map((a) => (
              <Link
                key={a.id}
                href={`/deals/${a.deal.id}`}
                className="block rounded-lg border border-slate-100 p-2 hover:bg-slate-50"
              >
                <div className="text-xs text-slate-400">
                  {formatDate(a.createdAt)} · {a.type}
                </div>
                <div className="text-sm">{a.message}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent deals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 font-medium">Deal</th>
                  <th className="pb-2 font-medium">Property</th>
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Offer</th>
                  <th className="pb-2 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {data.recentDeals.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <Link
                        href={`/deals/${d.id}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-600">
                      {d.property.address}, {d.property.city}
                    </td>
                    <td className="py-2">{d.agent?.name ?? "—"}</td>
                    <td className="py-2">{formatCurrency(d.offerPrice)}</td>
                    <td className="py-2">
                      <Badge className={stageColor(d.stage)}>
                        {stageLabel(d.stage)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
