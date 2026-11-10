import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.savedSearch.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(items.map((s) => ({ ...s, criteria: JSON.parse(s.criteria), columns: s.columns ? JSON.parse(s.columns) : null })));
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const data = { name, criteria: JSON.stringify(b.criteria ?? []), columns: b.columns ? JSON.stringify(b.columns) : null };
  const existing = await prisma.savedSearch.findFirst({ where: { name } });
  const saved = existing
    ? await prisma.savedSearch.update({ where: { id: existing.id }, data })
    : await prisma.savedSearch.create({ data });
  return NextResponse.json({ ...saved, criteria: JSON.parse(saved.criteria), columns: saved.columns ? JSON.parse(saved.columns) : null }, { status: existing ? 200 : 201 });
}
