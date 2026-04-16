-- Drop the old unique index (Prisma @@unique generates an INDEX, not a CONSTRAINT)
DROP INDEX IF EXISTS "Budget_userId_categoryId_period_key";

-- Create a partial unique index: only enforced when deletedAt IS NULL
CREATE UNIQUE INDEX "Budget_userId_categoryId_period_active_key"
  ON "Budget" ("userId", "categoryId", "period")
  WHERE "deletedAt" IS NULL;
