-- DropIndex
DROP INDEX "ChatMessage_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'fr';

-- CreateIndex
CREATE INDEX "Budget_userId_categoryId_period_idx" ON "Budget"("userId", "categoryId", "period");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_locale_createdAt_idx" ON "ChatMessage"("userId", "locale", "createdAt");
