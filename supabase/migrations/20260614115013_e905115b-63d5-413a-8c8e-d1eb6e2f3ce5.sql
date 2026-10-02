
-- presence: track online users
CREATE TABLE public.presence (
  user_id text PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presence TO anon, authenticated;
GRANT ALL ON public.presence TO service_role;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence open" ON public.presence FOR ALL USING (true) WITH CHECK (true);

-- waiting queue
CREATE TABLE public.waiting_queue (
  user_id text PRIMARY KEY,
  gender text NOT NULL CHECK (gender IN ('male','female')),
  age int NOT NULL CHECK (age BETWEEN 13 AND 120),
  want_gender text NOT NULL CHECK (want_gender IN ('male','female','any')),
  want_age_min int NOT NULL DEFAULT 13,
  want_age_max int NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_queue TO anon, authenticated;
GRANT ALL ON public.waiting_queue TO service_role;
ALTER TABLE public.waiting_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue open" ON public.waiting_queue FOR ALL USING (true) WITH CHECK (true);

-- rooms
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a text NOT NULL,
  user_b text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_rooms_users_idx ON public.chat_rooms (user_a, user_b);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_rooms TO anon, authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms open" ON public.chat_rooms FOR ALL USING (true) WITH CHECK (true);

-- messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_room_idx ON public.messages (room_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages open" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_queue;

-- matching function: tries to find a partner for user, otherwise inserts into queue
CREATE OR REPLACE FUNCTION public.find_or_queue_match(
  p_user_id text,
  p_gender text,
  p_age int,
  p_want_gender text,
  p_want_age_min int,
  p_want_age_max int
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner record;
  v_room_id uuid;
BEGIN
  -- remove stale self entry
  DELETE FROM public.waiting_queue WHERE user_id = p_user_id;

  -- find compatible partner (mutual match)
  SELECT * INTO v_partner
  FROM public.waiting_queue
  WHERE user_id <> p_user_id
    AND (p_want_gender = 'any' OR gender = p_want_gender)
    AND age BETWEEN p_want_age_min AND p_want_age_max
    AND (want_gender = 'any' OR want_gender = p_gender)
    AND p_age BETWEEN want_age_min AND want_age_max
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_partner.user_id IS NOT NULL THEN
    DELETE FROM public.waiting_queue WHERE user_id = v_partner.user_id;
    INSERT INTO public.chat_rooms (user_a, user_b)
    VALUES (p_user_id, v_partner.user_id)
    RETURNING id INTO v_room_id;
    RETURN v_room_id;
  END IF;

  INSERT INTO public.waiting_queue (user_id, gender, age, want_gender, want_age_min, want_age_max)
  VALUES (p_user_id, p_gender, p_age, p_want_gender, p_want_age_min, p_want_age_max);
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_queue_match(text,text,int,text,int,int) TO anon, authenticated;

-- find existing room for user (poll for waiter)
CREATE OR REPLACE FUNCTION public.find_room_for_user(p_user_id text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.chat_rooms
  WHERE active = true AND (user_a = p_user_id OR user_b = p_user_id)
  ORDER BY created_at DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_room_for_user(text) TO anon, authenticated;

-- online count
CREATE OR REPLACE FUNCTION public.online_count()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.presence WHERE last_seen > now() - interval '30 seconds';
$$;
GRANT EXECUTE ON FUNCTION public.online_count() TO anon, authenticated;
