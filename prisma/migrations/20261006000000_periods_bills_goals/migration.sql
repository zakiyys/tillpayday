-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "key" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "fundingAccountId" TEXT,
ADD COLUMN     "savingsAccountId" TEXT;

-- AlterTable
ALTER TABLE "Recurring" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "startDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Bill_householdId_key_key" ON "Bill"("householdId", "key");

