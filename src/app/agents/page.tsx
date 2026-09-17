"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Mail, Phone } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  licenseNo: string | null;
  notes: string | null;
  _count: { deals: number };
};

const empty = {
  name: "",
  email: "",
  phone: "",
  brokerage: "",
  licenseNo: "",
  notes: "",
};

export default function AgentsPage() {
  const [items, setItems] = useState<Agent[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () =>
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setItems);

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(empty);
    setShow(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-sm text-slate-500">Listing agents for offers</p>
        </div>
        <Button size="sm" onClick={() => setShow(!show)}>
          <Plus className="h-4 w-4" /> Add Agent
        </Button>
      </div>

      {show && (
        <Card>
          <CardHeader>
            <CardTitle>New agent</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Brokerage</Label>
                <Input
                  value={form.brokerage}
                  onChange={(e) =>
                    setForm({ ...form, brokerage: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>License #</Label>
                <Input
                  value={form.licenseNo}
                  onChange={(e) =>
                    setForm({ ...form, licenseNo: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit">Save</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShow(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="font-semibold">{a.name}</div>
              <div className="text-sm text-slate-500">
                {a.brokerage || "Independent"}
              </div>
              {a.email && (
                <div className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                  <Mail className="h-3.5 w-3.5" /> {a.email}
                </div>
              )}
              {a.phone && (
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <Phone className="h-3.5 w-3.5" /> {a.phone}
                </div>
              )}
              <div className="mt-3 text-xs text-slate-400">
                {a._count.deals} deal{a._count.deals === 1 ? "" : "s"} ·{" "}
                {a.licenseNo || "No license on file"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
