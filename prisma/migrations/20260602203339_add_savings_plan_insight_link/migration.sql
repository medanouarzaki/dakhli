-- AlterTable
ALTER TABLE "AiInsight" ADD COLUMN     "goalId" TEXT;

-- CreateIndex
CREATE INDEX "AiInsight_goalId_idx" ON "AiInsight"("goalId");

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
