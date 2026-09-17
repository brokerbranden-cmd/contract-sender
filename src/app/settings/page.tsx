"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";

type Settings = {
  buyerName: string;
  buyerEntity: string;
  buyerAddress: string;
  buyerCity: string;
  buyerState: string;
  buyerZip: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerSignatory: string;
  defaultEarnest: number;
  defaultClosingDays: number;
  defaultInspectionDays: number;
  emailSubjectTpl: string;
  emailBodyTpl: string;
};

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setForm);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setForm(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!form) return <div className="text-slate-500">Loading settings…</div>;

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-500">
          Buyer defaults for Prop Hunters / Branden — edit anytime
        </p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Buyer identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Buyer Name</Label>
              <Input
                value={form.buyerName}
                onChange={(e) => set("buyerName", e.target.value)}
              />
            </div>
            <div>
              <Label>Entity</Label>
              <Input
                value={form.buyerEntity}
                onChange={(e) => set("buyerEntity", e.target.value)}
              />
            </div>
            <div>
              <Label>Signatory</Label>
              <Input
                value={form.buyerSignatory}
                onChange={(e) => set("buyerSignatory", e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.buyerEmail}
                onChange={(e) => set("buyerEmail", e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.buyerPhone}
                onChange={(e) => set("buyerPhone", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.buyerAddress}
                onChange={(e) => set("buyerAddress", e.target.value)}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={form.buyerCity}
                onChange={(e) => set("buyerCity", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>State</Label>
                <Input
                  value={form.buyerState}
                  onChange={(e) => set("buyerState", e.target.value)}
                />
              </div>
              <div>
                <Label>Zip</Label>
                <Input
                  value={form.buyerZip}
                  onChange={(e) => set("buyerZip", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default offer terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Earnest ($)</Label>
              <Input
                type="number"
                value={form.defaultEarnest}
                onChange={(e) =>
                  set("defaultEarnest", Number(e.target.value))
                }
              />
            </div>
            <div>
              <Label>Closing Days</Label>
              <Input
                type="number"
                value={form.defaultClosingDays}
                onChange={(e) =>
                  set("defaultClosingDays", Number(e.target.value))
                }
              />
            </div>
            <div>
              <Label>Inspection Days</Label>
              <Input
                type="number"
                value={form.defaultInspectionDays}
                onChange={(e) =>
                  set("defaultInspectionDays", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Input
                value={form.emailSubjectTpl}
                onChange={(e) => set("emailSubjectTpl", e.target.value)}
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                className="min-h-[160px]"
                value={form.emailBodyTpl}
                onChange={(e) => set("emailBodyTpl", e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500">
              Placeholders: {"{{address}}"}, {"{{agentName}}"}, {"{{offerPrice}}"},{" "}
              {"{{buyerName}}"}, {"{{buyerSignatory}}"}, {"{{buyerPhone}}"},{" "}
              {"{{buyerEmail}}"}, {"{{closingDays}}"}
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
          </Button>
          {saved && (
            <span className="text-sm text-emerald-600">Saved.</span>
          )}
        </div>
      </form>
    </div>
  );
}
