"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";
import { Select } from "@/components/ui/select";
import { CONTRACT_TYPE_OPTIONS, FarBarMissingNotice, useFarBarStatus } from "@/components/contract-type";

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
  dailySendCap: number;
  duplicateGuardDays: number;
  defaultOfferPct: number;
  emailSubjectTpl: string;
  emailBodyTpl: string;
  defaultContractType: string;
  farbarFormPath: string;
  escrowAgentName: string;
  escrowAgentAddress: string;
  escrowAgentPhone: string;
  escrowAgentEmail: string;
  escrowAgentFax: string;
  depositDays: number;
  acceptanceDays: number;
  assignability: string;
  cooperatingSalesAssociate: string;
  cooperatingBroker: string;
  farbarAdditionalTerms: string;
};

type StrKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const farbar = useFarBarStatus();

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
            <CardTitle>FAR/BAR AS IS contract (official form)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FarBarMissingNotice status={farbar} />
            {farbar?.exists && (
              <p className="text-sm text-emerald-700">
                Form found at <code className="break-all">{farbar.path}</code>
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Default contract type</Label>
                <Select value={form.defaultContractType} onChange={(e) => set("defaultContractType", e.target.value)}>
                  {CONTRACT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Form PDF path (blank = forms/farbar-asis.pdf)</Label>
                <Input value={form.farbarFormPath} placeholder="forms/farbar-asis.pdf" onChange={(e) => set("farbarFormPath", e.target.value)} />
              </div>
              {([
                ["escrowAgentName", "Escrow agent name"],
                ["escrowAgentAddress", "Escrow agent address"],
                ["escrowAgentPhone", "Escrow agent phone"],
                ["escrowAgentEmail", "Escrow agent email"],
                ["escrowAgentFax", "Escrow agent fax"],
                ["cooperatingSalesAssociate", "Cooperating sales associate"],
                ["cooperatingBroker", "Cooperating broker (brokerage)"],
              ] as [StrKey, string][]).map(([k, label]) => (
                <div key={k}>
                  <Label>{label}</Label>
                  <Input value={form[k] as string} onChange={(e) => set(k, e.target.value)} />
                </div>
              ))}
              <div>
                <Label>Initial deposit due within (days)</Label>
                <Input type="number" min={0} value={form.depositDays} onChange={(e) => set("depositDays", Number(e.target.value))} />
              </div>
              <div>
                <Label>Offer acceptance deadline (days from today, 0 = blank)</Label>
                <Input type="number" min={0} value={form.acceptanceDays} onChange={(e) => set("acceptanceDays", Number(e.target.value))} />
              </div>
              <div>
                <Label>Assignability (paragraph 7)</Label>
                <Select value={form.assignability} onChange={(e) => set("assignability", e.target.value)}>
                  <option value="assign_released">May assign and be released</option>
                  <option value="assign_not_released">May assign but not be released</option>
                  <option value="no_assign">May not assign</option>
                  <option value="">Leave blank</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Additional terms (paragraph 20)</Label>
              <Textarea className="min-h-[100px]" value={form.farbarAdditionalTerms} onChange={(e) => set("farbarAdditionalTerms", e.target.value)} />
            </div>
            <p className="text-xs text-slate-500">
              Buyer (paragraph 1) uses Entity; buyer&apos;s notice address uses the Buyer identity address. Seller, Tax ID and legal
              description come from the property (edit on the deal page). Initials and signatures are always left blank.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk offers &amp; sending</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Default offer (% of list price)</Label>
              <Input
                type="number"
                step="0.5"
                value={form.defaultOfferPct}
                onChange={(e) => set("defaultOfferPct", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Daily send cap (emails/day)</Label>
              <Input
                type="number"
                min={0}
                value={form.dailySendCap}
                onChange={(e) => set("dailySendCap", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Duplicate guard (days)</Label>
              <Input
                type="number"
                min={0}
                value={form.duplicateGuardDays}
                onChange={(e) =>
                  set("duplicateGuardDays", Number(e.target.value))
                }
              />
            </div>
            <p className="text-xs text-slate-500 sm:col-span-3">
              Offers are rounded to the nearest $1,000. The same property will
              not be re-offered within the guard window (0 = off). The daily cap
              limits Mark sent / batch export per calendar day.
            </p>
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
              {"{{buyerEmail}}"}, {"{{closingDays}}"}. Bulk offers also accept
              snake_case: {"{{offer_price}}"}, {"{{agent_first_name}}"},{" "}
              {"{{list_price}}"}, {"{{mls_number}}"}, {"{{earnest_money}}"}
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
