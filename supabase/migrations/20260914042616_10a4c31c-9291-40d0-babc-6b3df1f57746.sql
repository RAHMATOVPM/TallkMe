-- 1) Profiles must not be broadcast over Realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles';
  END IF;
END
$$;

-- Ensure no client-side access to profiles remains (server-side only via service role)
REVOKE ALL ON public.profiles FROM anon, authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- 2) Explicit deny policies for private storage buckets
DROP POLICY IF EXISTS "private buckets no client read" ON storage.objects;
DROP POLICY IF EXISTS "private buckets no client insert" ON storage.objects;
DROP POLICY IF EXISTS "private buckets no client update" ON storage.objects;
DROP POLICY IF EXISTS "private buckets no client delete" ON storage.objects;

CREATE POLICY "private buckets no client read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id NOT IN ('avatars', 'chat-media'));

CREATE POLICY "private buckets no client insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id NOT IN ('avatars', 'chat-media'));

CREATE POLICY "private buckets no client update"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id NOT IN ('avatars', 'chat-media'))
  WITH CHECK (bucket_id NOT IN ('avatars', 'chat-media'));

CREATE POLICY "private buckets no client delete"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id NOT IN ('avatars', 'chat-media'));