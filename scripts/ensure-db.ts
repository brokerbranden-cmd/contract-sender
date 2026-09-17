import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

async function main() {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

  const prisma = new PrismaClient();
  try {
    const count = await prisma.deal.count();
    if (count === 0) {
      console.log("No deals found — running seed…");
      execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
    } else {
      console.log(`DB ready (${count} deals).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
