"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";

type Property = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  mlsNumber: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  notes: string | null;
  _count: { deals: number };
};

const empty = {
  address: "",
  city: "",
  state: "FL",
  zip: "",
  mlsNumber: "",
  listPrice: "",
  beds: "",
  baths: "",
  sqft: "",
  yearBuilt: "",
  propertyType: "Single Family",
  notes: "",
};

export default function PropertiesPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () =>
    fetch("/api/properties")
      .then((r) => r.json())
      .then(setItems);

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        listPrice: form.listPrice ? Number(form.listPrice) : null,
        beds: form.beds ? Number(form.beds) : null,
        baths: form.baths ? Number(form.baths) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : null,
      }),
    });
    setForm(empty);
    setShow(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-sm text-slate-500">MLS-listed inventory</p>
        </div>
        <Button size="sm" onClick={() => setShow(!show)}>
          <Plus className="h-4 w-4" /> Add Property
        </Button>
      </div>

      {show && (
        <Card>
          <CardHeader>
            <CardTitle>New property</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Input
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>State</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Zip</Label>
                  <Input
                    required
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>MLS #</Label>
                <Input
                  value={form.mlsNumber}
                  onChange={(e) =>
                    setForm({ ...form, mlsNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>List Price</Label>
                <Input
                  type="number"
                  value={form.listPrice}
                  onChange={(e) =>
                    setForm({ ...form, listPrice: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={form.propertyType}
                  onChange={(e) =>
                    setForm({ ...form, propertyType: e.target.value })
                  }
                >
                  <option>Single Family</option>
                  <option>Condo</option>
                  <option>Townhouse</option>
                  <option>Multi-Family</option>
                  <option>Land</option>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Beds</Label>
                  <Input
                    type="number"
                    value={form.beds}
                    onChange={(e) => setForm({ ...form, beds: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Baths</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={form.baths}
                    onChange={(e) => setForm({ ...form, baths: e.target.value })}
                  />
                </div>
                <div>
                  <Label>SqFt</Label>
                  <Input
                    type="number"
                    value={form.sqft}
                    onChange={(e) => setForm({ ...form, sqft: e.target.value })}
                  />
                </div>
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

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-slate-500">
                <th className="p-3 font-medium">Address</th>
                <th className="p-3 font-medium">MLS</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Beds/Baths</th>
                <th className="p-3 font-medium">List</th>
                <th className="p-3 font-medium">Deals</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="p-3">
                    <div className="font-medium">{p.address}</div>
                    <div className="text-xs text-slate-500">
                      {p.city}, {p.state} {p.zip}
                    </div>
                  </td>
                  <td className="p-3">{p.mlsNumber ?? "—"}</td>
                  <td className="p-3">{p.propertyType}</td>
                  <td className="p-3">
                    {p.beds ?? "—"}/{p.baths ?? "—"}
                  </td>
                  <td className="p-3">{formatCurrency(p.listPrice)}</td>
                  <td className="p-3">{p._count.deals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
