-- Enable RLS (deny-by-default) on all tables in the public schema.
-- No policies are added: Prisma's owner role bypasses RLS automatically.
-- FORCE is intentionally NOT used — owner access must remain unrestricted.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
