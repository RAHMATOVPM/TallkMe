DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM authenticated;
GRANT ALL ON public.profiles TO service_role;