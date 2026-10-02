-- chat_rooms: participants only
DROP POLICY IF EXISTS "rooms open" ON public.chat_rooms;
REVOKE ALL ON public.chat_rooms FROM anon;
GRANT SELECT, UPDATE ON public.chat_rooms TO authenticated;
REVOKE INSERT, DELETE ON public.chat_rooms FROM authenticated;
CREATE POLICY "rooms participants read" ON public.chat_rooms FOR SELECT TO authenticated
  USING ((auth.uid())::text IN (user_a, user_b));
CREATE POLICY "rooms participants update" ON public.chat_rooms FOR UPDATE TO authenticated
  USING ((auth.uid())::text IN (user_a, user_b))
  WITH CHECK ((auth.uid())::text IN (user_a, user_b));

-- messages: participants only, send as self
DROP POLICY IF EXISTS "messages open" ON public.messages;
REVOKE ALL ON public.messages FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
REVOKE DELETE ON public.messages FROM authenticated;
CREATE POLICY "messages participants read" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND (auth.uid())::text IN (r.user_a, r.user_b)));
CREATE POLICY "messages send as self" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (auth.uid())::text AND EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.active AND (auth.uid())::text IN (r.user_a, r.user_b)));
CREATE POLICY "messages participants update" ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND (auth.uid())::text IN (r.user_a, r.user_b)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND (auth.uid())::text IN (r.user_a, r.user_b)));

-- waiting_queue: own row only
DROP POLICY IF EXISTS "queue open" ON public.waiting_queue;
REVOKE ALL ON public.waiting_queue FROM anon;
GRANT SELECT, DELETE ON public.waiting_queue TO authenticated;
REVOKE INSERT, UPDATE ON public.waiting_queue FROM authenticated;
CREATE POLICY "queue own read" ON public.waiting_queue FOR SELECT TO authenticated USING (user_id = (auth.uid())::text);
CREATE POLICY "queue own delete" ON public.waiting_queue FOR DELETE TO authenticated USING (user_id = (auth.uid())::text);

-- presence: own row only
DROP POLICY IF EXISTS "presence open" ON public.presence;
REVOKE ALL ON public.presence FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.presence TO authenticated;
CREATE POLICY "presence own read" ON public.presence FOR SELECT TO authenticated USING (user_id = (auth.uid())::text);
CREATE POLICY "presence own insert" ON public.presence FOR INSERT TO authenticated WITH CHECK (user_id = (auth.uid())::text);
CREATE POLICY "presence own update" ON public.presence FOR UPDATE TO authenticated USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);

-- functions: bind to caller identity
CREATE OR REPLACE FUNCTION public.find_or_queue_match(p_user_id text, p_gender text, p_age integer, p_want_gender text, p_want_age_min integer, p_want_age_max integer)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_partner record;
  v_room_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = p_user_id AND banned_until > now()) THEN
    RAISE EXCEPTION 'USER_BANNED';
  END IF;
  DELETE FROM public.waiting_queue WHERE user_id = p_user_id;
  SELECT * INTO v_partner FROM public.waiting_queue
  WHERE user_id <> p_user_id
    AND (p_want_gender = 'any' OR gender = p_want_gender)
    AND age BETWEEN p_want_age_min AND p_want_age_max
    AND (want_gender = 'any' OR want_gender = p_gender)
    AND p_age BETWEEN want_age_min AND want_age_max
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = waiting_queue.user_id)
         OR (b.blocker_id = waiting_queue.user_id AND b.blocked_id = p_user_id))
    AND NOT EXISTS (SELECT 1 FROM public.user_bans nb WHERE nb.user_id = waiting_queue.user_id AND nb.banned_until > now())
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF v_partner.user_id IS NOT NULL THEN
    DELETE FROM public.waiting_queue WHERE user_id = v_partner.user_id;
    INSERT INTO public.chat_rooms (user_a, user_b) VALUES (p_user_id, v_partner.user_id) RETURNING id INTO v_room_id;
    RETURN v_room_id;
  END IF;
  INSERT INTO public.waiting_queue (user_id, gender, age, want_gender, want_age_min, want_age_max)
  VALUES (p_user_id, p_gender, p_age, p_want_gender, p_want_age_min, p_want_age_max);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_room_for_user(p_user_id text)
 RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id FROM public.chat_rooms
  WHERE active = true AND p_user_id = auth.uid()::text AND (user_a = p_user_id OR user_b = p_user_id)
  ORDER BY created_at DESC LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.find_or_queue_match(text,text,integer,text,integer,integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_room_for_user(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.online_count() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_or_queue_match(text,text,integer,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_room_for_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.online_count() TO authenticated;