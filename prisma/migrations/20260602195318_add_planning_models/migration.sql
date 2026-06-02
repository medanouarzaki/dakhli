-- CreateEnum
CREATE TYPE "RecurringType" AS ENUM ('REVENUE', 'CHARGE');

-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "RecurringItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RecurringType" NOT NULL,
    "label" TEXT NOT NULL,
    "amountMAD" DECIMAL(12,2) NOT NULL,
    "periodicity" "Periodicity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RecurringItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExceptionalCharge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountMAD" DECIMAL(12,2) NOT NULL,
    "startMonth" TIMESTAMP(3) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExceptionalCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringItem_userId_idx" ON "RecurringItem"("userId");

-- CreateIndex
CREATE INDEX "ExceptionalCharge_userId_idx" ON "ExceptionalCharge"("userId");

-- AddForeignKey
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionalCharge" ADD CONSTRAINT "ExceptionalCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
