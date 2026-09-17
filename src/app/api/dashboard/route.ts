import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEAL_STAGES } from "@/lib/utils";

export async function GET() {
  const [deals, recentActivities, propertiesCount, agentsCount] =
    await Promise.all([
      prisma.deal.findMany({
        include: { property: true, agent: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.activity.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
        include: { deal: { include: { property: true } } },
      }),
      prisma.property.count(),
      prisma.agent.count(),
    ]);

  const byStage = DEAL_STAGES.map((s) => ({
    ...s,
    count: deals.filter((d) => d.stage === s.id).length,
  }));

  const active = deals.filter(
    (d) => !["closed", "dead"].includes(d.stage)
  ).length;
  const pipelineValue = deals
    .filter((d) => !["closed", "dead"].includes(d.stage))
    .reduce((sum, d) => sum + (d.offerPrice || 0), 0);

  return NextResponse.json({
    stats: {
      activeDeals: active,
      totalDeals: deals.length,
      properties: propertiesCount,
      agents: agentsCount,
      pipelineValue,
    },
    byStage,
    recentDeals: deals.slice(0, 5),
    recentActivities,
  });
}
