// npm run db:seed-demo -- <owner e-mail>
// Fills that owner's household with made-up demo data (SPEC 9.4). Refuses if it already has transactions.
import { prisma } from "../src/server/db";
import { seedDemo } from "../src/server/onboarding/demo";
import { todayIn } from "../src/domain/dates";

const email = process.argv[2];
if (!email) {
  console.error("usage: npm run db:seed-demo -- <owner e-mail>");
  process.exit(1);
}
const m = await prisma.member.findUnique({ where: { email: email.toLowerCase() }, include: { household: true } });
if (!m) {
  console.error("no member with that e-mail");
  process.exit(1);
}
await seedDemo({ householdId: m.householdId, memberId: m.id, via: "UI" }, todayIn(m.household.timezone));
console.log("demo data added");
await prisma.$disconnect();
