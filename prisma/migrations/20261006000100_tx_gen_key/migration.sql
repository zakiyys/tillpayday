-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "genKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_householdId_genKey_key" ON "Transaction"("householdId", "genKey");

