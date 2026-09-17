"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";

type Template = {
  id: string;
  name: string;
  description: string | null;
  body: string;
  isDefault: boolean;
};

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const t = await fetch("/api/templates").then((r) => r.json());
    setItems(t);
    if (!selected && t[0]) setSelected(t[0]);
    else if (selected) {
      const updated = t.find((x: Template) => x.id === selected.id);
      if (updated) setSelected(updated);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/templates/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    setSaving(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-sm text-slate-500">
          Custom Florida AS-IS investor offer templates. Use{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {"{{placeholders}}"}
          </code>{" "}
          for merge fields.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                  selected?.id === t.id
                    ? "border-sky-400 bg-sky-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t.name}</span>
                  {t.isDefault && (
                    <Badge className="bg-sky-100 text-sky-700">Default</Badge>
                  )}
                </div>
                {t.description && (
                  <div className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {t.description}
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {selected && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Edit template</CardTitle>
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={selected.name}
                  onChange={(e) =>
                    setSelected({ ...selected, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={selected.description ?? ""}
                  onChange={(e) =>
                    setSelected({ ...selected, description: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Body</Label>
                <Textarea
                  className="min-h-[420px] font-mono text-xs"
                  value={selected.body}
                  onChange={(e) =>
                    setSelected({ ...selected, body: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.isDefault}
                  onChange={(e) =>
                    setSelected({ ...selected, isDefault: e.target.checked })
                  }
                />
                Default template for new contracts
              </label>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
