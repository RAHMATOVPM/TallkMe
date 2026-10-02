CREATE TABLE public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  reason text NOT NULL,
  banned_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_bans_user ON public.user_bans (user_id, banned_until DESC);
GRANT ALL ON public.user_bans TO service_role;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_user_banned(p_user_id text)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT MAX(banned_until) FROM public.user_bans
  WHERE user_id = p_user_id AND banned_until > now();
$$;
GRANT EXECUTE ON FUNCTION public.is_user_banned(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.find_or_queue_match(p_user_id text, p_gender text, p_age integer, p_want_gender text, p_want_age_min integer, p_want_age_max integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_partner record;
  v_room_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = p_user_id AND banned_until > now()) THEN
    RAISE EXCEPTION 'USER_BANNED';
  END IF;

  DELETE FROM public.waiting_queue WHERE user_id = p_user_id;

  SELECT * INTO v_partner
  FROM public.waiting_queue
  WHERE user_id <> p_user_id
    AND (p_want_gender = 'any' OR gender = p_want_gender)
    AND age BETWEEN p_want_age_min AND p_want_age_max
    AND (want_gender = 'any' OR want_gender = p_gender)
    AND p_age BETWEEN want_age_min AND want_age_max
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = waiting_queue.user_id)
         OR (b.blocker_id = waiting_queue.user_id AND b.blocked_id = p_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_bans nb
      WHERE nb.user_id = waiting_queue.user_id AND nb.banned_until > now()
    )
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
$function$;