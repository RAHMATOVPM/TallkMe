DROP POLICY IF EXISTS "private buckets no client delete" ON storage.objects;
DROP POLICY IF EXISTS "private buckets no client insert" ON storage.objects;
DROP POLICY IF EXISTS "private buckets no client read" ON storage.objects;
DROP POLICY IF EXISTS "private buckets no client update" ON storage.objects;
DROP POLICY IF EXISTS "reports insert" ON public.user_reports;
REVOKE INSERT ON public.user_reports FROM anon, authenticated;