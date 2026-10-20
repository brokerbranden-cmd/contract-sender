import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { farBarFormExists, resolveFarBarPath } from "@/lib/farbar/fill";

export const dynamic = "force-dynamic";

/** GET → { exists, path } for the licensed FAR/BAR AS IS form PDF. */
export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const p = settings?.farbarFormPath ?? "";
  return NextResponse.json({ exists: farBarFormExists(p), path: resolveFarBarPath(p) });
}
