-- 1. Server-only tables: ensure RLS on, no policies, no client grants
ALTER TABLE public.auth_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_phones FROM anon, authenticated;
REVOKE ALL ON public.phone_codes FROM anon, authenticated;
REVOKE ALL ON public.conversations FROM anon, authenticated;
REVOKE ALL ON public.dm_messages FROM anon, authenticated;
REVOKE ALL ON public.friendships FROM anon, authenticated;
REVOKE ALL ON public.typing_status FROM anon, authenticated;

GRANT ALL ON public.auth_phones TO service_role;
GRANT ALL ON public.phone_codes TO service_role;
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.dm_messages TO service_role;
GRANT ALL ON public.friendships TO service_role;
GRANT ALL ON public.typing_status TO service_role;

-- 2. user_blocks: not client accessible; used by SECURITY DEFINER matching only
DROP POLICY IF EXISTS "blocks open" ON public.user_blocks;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_blocks FROM anon, authenticated;
GRANT ALL ON public.user_blocks TO service_role;

-- 3. user_reports: submit-only, no client reads
DROP POLICY IF EXISTS "reports select own" ON public.user_reports;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_reports FROM anon, authenticated;
GRANT INSERT ON public.user_reports TO anon, authenticated;
GRANT ALL ON public.user_reports TO service_role;

-- 4. profiles: hide PII columns (email, phone) from clients
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (user_id, nickname, display_name, avatar_emoji, bio, gender, age, avatar_url, last_seen, created_at)
  ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 5. storage: remove blanket-open object policies
DROP POLICY IF EXISTS "media read all" ON storage.objects;
DROP POLICY IF EXISTS "media insert all" ON storage.objects;
DROP POLICY IF EXISTS "media update all" ON storage.objects;
DROP POLICY IF EXISTS "media delete all" ON storage.objects;