"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Property = { id: string; address: string; city: string; listPrice: number | null };
type Agent = { id: string; name: string; brokerage: string | null };

export default function NewDealPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    propertyId: "",
    agentId: "",
    offerPrice: "",
    earnestMoney: "1000",
    closingDays: "30",
    inspectionDays: "10",
    financingType: "Cash",
    contingencies: "",
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/properties").then((r) => r.json()),
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([props, ags, settings]) => {
      setProperties(props);
      setAgents(ags);
      setForm((f) => ({
        ...f,
        earnestMoney: String(settings.defaultEarnest ?? 1000),
        closingDays: String(settings.defaultClosingDays ?? 30),
        inspectionDays: String(settings.defaultInspectionDays ?? 10),
      }));
    });
  }, []);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        agentId: form.agentId || null,
        offerPrice: form.offerPrice ? Number(form.offerPrice) : null,
        earnestMoney: Number(form.earnestMoney),
        closingDays: Number(form.closingDays),
        inspectionDays: Number(form.inspectionDays),
      }),
    });
    const deal = await res.json();
    setSaving(false);
    if (res.ok) router.push(`/deals/${deal.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Deal</h1>
        <p className="text-sm text-slate-500">
          Attach MLS property + listing agent, set offer terms
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Deal details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. FTL NW 12th — AS-IS offer"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Property</Label>
                <Select
                  required
                  value={form.propertyId}
                  onChange={(e) => {
                    set("propertyId", e.target.value);
                    const p = properties.find((x) => x.id === e.target.value);
                    if (p && !form.title) {
                      set("title", `${p.city} ${p.address.split(" ").slice(-2).join(" ")} offer`);
                    }
                  }}
                >
                  <option value="">Select property…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}, {p.city}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Listing Agent</Label>
                <Select
                  value={form.agentId}
                  onChange={(e) => set("agentId", e.target.value)}
                >
                  <option value="">Select agent…</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.brokerage ? ` · ${a.brokerage}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Offer Price</Label>
                <Input
                  type="number"
                  value={form.offerPrice}
                  onChange={(e) => set("offerPrice", e.target.value)}
                />
              </div>
              <div>
                <Label>Earnest Money</Label>
                <Input
                  type="number"
                  value={form.earnestMoney}
                  onChange={(e) => set("earnestMoney", e.target.value)}
                />
              </div>
              <div>
                <Label>Closing Days</Label>
                <Input
                  type="number"
                  value={form.closingDays}
                  onChange={(e) => set("closingDays", e.target.value)}
                />
              </div>
              <div>
                <Label>Inspection Days</Label>
                <Input
                  type="number"
                  value={form.inspectionDays}
                  onChange={(e) => set("inspectionDays", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Financing</Label>
              <Select
                value={form.financingType}
                onChange={(e) => set("financingType", e.target.value)}
              >
                <option>Cash</option>
                <option>Conventional</option>
                <option>Hard Money</option>
                <option>Seller Finance</option>
              </Select>
            </div>
            <div>
              <Label>Contingencies / Other Terms</Label>
              <Textarea
                value={form.contingencies}
                onChange={(e) => set("contingencies", e.target.value)}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Deal"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
