BEGIN;

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversations_participants_read ON public.conversations;
CREATE POLICY conversations_participants_read ON public.conversations FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));
REVOKE ALL ON public.conversations FROM anon, authenticated;
GRANT SELECT ON public.conversations TO authenticated;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = p_conversation AND auth.uid() IN (c.user_a, c.user_b));
$$;
REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

INSERT INTO public.conversations(user_a, user_b, last_message_at)
SELECT LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), max(created_at)
FROM public.messages WHERE sender_id <> recipient_id GROUP BY 1, 2
ON CONFLICT (user_a, user_b) DO UPDATE SET last_message_at = GREATEST(public.conversations.last_message_at, EXCLUDED.last_message_at);

INSERT INTO public.conversations(user_a, user_b, last_message_at)
SELECT LEAST(r.user_id, mt.helper_id), GREATEST(r.user_id, mt.helper_id), mt.created_at
FROM public.matches mt JOIN public.meal_requests r ON r.id = mt.request_id
WHERE r.user_id <> mt.helper_id
ON CONFLICT (user_a, user_b) DO NOTHING;

INSERT INTO public.conversations(user_a, user_b, last_message_at)
SELECT LEAST(fd.user_id, fc.claimer_id), GREATEST(fd.user_id, fc.claimer_id), fc.created_at
FROM public.food_claims fc JOIN public.food_donations fd ON fd.id = fc.food_donation_id
WHERE fd.user_id <> fc.claimer_id
ON CONFLICT (user_a, user_b) DO NOTHING;

UPDATE public.messages m SET conversation_id = c.id
FROM public.conversations c
WHERE m.conversation_id IS NULL AND c.user_a = LEAST(m.sender_id, m.recipient_id) AND c.user_b = GREATEST(m.sender_id, m.recipient_id);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS conversations_user_a_latest_idx ON public.conversations(user_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user_b_latest_idx ON public.conversations(user_b, last_message_at DESC);

CREATE OR REPLACE FUNCTION public.can_start_conversation(p_other uuid, p_food uuid DEFAULT NULL, p_request uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND p_other <> auth.uid() AND (
    EXISTS (SELECT 1 FROM public.messages WHERE (sender_id = auth.uid() AND recipient_id = p_other) OR (sender_id = p_other AND recipient_id = auth.uid()))
    OR (p_food IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.food_donations d JOIN public.food_claims fc ON fc.food_donation_id = d.id
      WHERE d.id = p_food AND ((d.user_id = auth.uid() AND fc.claimer_id = p_other) OR (d.user_id = p_other AND fc.claimer_id = auth.uid()))
    ))
    OR (p_request IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.meal_requests r JOIN public.matches mt ON mt.request_id = r.id
      WHERE r.id = p_request AND ((r.user_id = auth.uid() AND mt.helper_id = p_other) OR (r.user_id = p_other AND mt.helper_id = auth.uid()))
    ))
  );
$$;
REVOKE ALL ON FUNCTION public.can_start_conversation(uuid, uuid, uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.ensure_conversation(p_other uuid, p_food uuid DEFAULT NULL, p_request uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_a uuid := LEAST(auth.uid(), p_other); v_b uuid := GREATEST(auth.uid(), p_other);
BEGIN
  IF NOT public.can_start_conversation(p_other, p_food, p_request) THEN RAISE EXCEPTION 'Conversation is not authorized'; END IF;
  INSERT INTO public.conversations(user_a, user_b) VALUES (v_a, v_b)
  ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = EXCLUDED.user_a RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.ensure_conversation(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_conversation(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS messages_read_participants ON public.messages;
DROP POLICY IF EXISTS "select_own_meal_request_messages" ON public.messages;
DROP POLICY IF EXISTS select_own_meal_request_messages ON public.messages;
CREATE POLICY messages_read_participants ON public.messages FOR SELECT TO authenticated
USING (public.is_conversation_participant(conversation_id));
DROP POLICY IF EXISTS messages_insert_sender ON public.messages;
DROP POLICY IF EXISTS "insert_own_meal_request_messages" ON public.messages;
DROP POLICY IF EXISTS insert_own_meal_request_messages ON public.messages;
CREATE POLICY messages_insert_sender ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id) AND recipient_id IN (
  SELECT CASE WHEN user_a = auth.uid() THEN user_b ELSE user_a END FROM public.conversations WHERE id = conversation_id
));
DROP POLICY IF EXISTS messages_update_recipient_read ON public.messages;
DROP POLICY IF EXISTS "update_own_meal_request_messages" ON public.messages;
DROP POLICY IF EXISTS update_own_meal_request_messages ON public.messages;
CREATE POLICY messages_update_recipient_read ON public.messages FOR UPDATE TO authenticated
USING (recipient_id = auth.uid() AND public.is_conversation_participant(conversation_id))
WITH CHECK (recipient_id = auth.uid() AND public.is_conversation_participant(conversation_id));
DROP POLICY IF EXISTS messages_delete_sender ON public.messages;
DROP POLICY IF EXISTS "delete_own_meal_request_messages" ON public.messages;
DROP POLICY IF EXISTS delete_own_meal_request_messages ON public.messages;
CREATE POLICY messages_delete_sender ON public.messages FOR DELETE TO authenticated
USING (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id));

CREATE OR REPLACE FUNCTION public.attach_message_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.conversation_id IS NULL THEN
    NEW.conversation_id := public.ensure_conversation(NEW.recipient_id, NEW.food_donation_id, NEW.meal_request_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = NEW.conversation_id AND (auth.uid() IS NULL OR auth.uid() IN (c.user_a, c.user_b)) AND NEW.recipient_id IN (c.user_a, c.user_b) AND NEW.sender_id IN (c.user_a, c.user_b)) THEN
    RAISE EXCEPTION 'Invalid conversation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS messages_attach_conversation ON public.messages;
CREATE TRIGGER messages_attach_conversation BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.attach_message_conversation();

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS messages_touch_conversation ON public.messages;
CREATE TRIGGER messages_touch_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

CREATE OR REPLACE FUNCTION public.create_conversation_for_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_requester uuid;
BEGIN
  SELECT user_id INTO v_requester FROM public.meal_requests WHERE id = NEW.request_id;
  IF v_requester IS NOT NULL AND v_requester <> NEW.helper_id THEN
    INSERT INTO public.conversations(user_a, user_b, last_message_at)
    VALUES (LEAST(v_requester, NEW.helper_id), GREATEST(v_requester, NEW.helper_id), NEW.created_at)
    ON CONFLICT (user_a, user_b) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS matches_create_conversation ON public.matches;
CREATE TRIGGER matches_create_conversation AFTER INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.create_conversation_for_match();
REVOKE ALL ON FUNCTION public.create_conversation_for_match() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_conversation_for_food_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_donor uuid;
BEGIN
  SELECT user_id INTO v_donor FROM public.food_donations WHERE id = NEW.food_donation_id;
  IF v_donor IS NOT NULL AND v_donor <> NEW.claimer_id THEN
    INSERT INTO public.conversations(user_a, user_b, last_message_at)
    VALUES (LEAST(v_donor, NEW.claimer_id), GREATEST(v_donor, NEW.claimer_id), NEW.created_at)
    ON CONFLICT (user_a, user_b) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS food_claims_create_conversation ON public.food_claims;
CREATE TRIGGER food_claims_create_conversation AFTER INSERT ON public.food_claims FOR EACH ROW EXECUTE FUNCTION public.create_conversation_for_food_claim();
REVOKE ALL ON FUNCTION public.create_conversation_for_food_claim() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_conversation_after_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = COALESCE(
    (SELECT max(created_at) FROM public.messages WHERE conversation_id = OLD.conversation_id), created_at
  ) WHERE id = OLD.conversation_id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS messages_refresh_conversation_after_delete ON public.messages;
CREATE TRIGGER messages_refresh_conversation_after_delete AFTER DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_after_delete();

-- Real donor statistics: donated meal quantity and distinct helped recipients.
CREATE OR REPLACE VIEW public.donor_statistics WITH (security_invoker = true) AS
SELECT p.id AS user_id,
  COALESCE((SELECT sum(fd.meals) FROM public.food_donations fd WHERE fd.user_id = p.id AND fd.status IN ('received','completed','rated')), 0)::bigint AS donated_meals,
  COALESCE((SELECT count(DISTINCT fc.claimer_id) FROM public.food_donations fd JOIN public.food_claims fc ON fc.food_donation_id = fd.id WHERE fd.user_id = p.id AND fc.status IN ('received','completed')), 0)::bigint AS people_helped
FROM public.profiles p;
GRANT SELECT ON public.donor_statistics TO authenticated;

-- Expose only aggregate review counts for public donor cards, not review records.
CREATE OR REPLACE VIEW public.public_rating_counts WITH (security_invoker = false) AS
SELECT reviewee_id, count(*)::bigint AS rating_count
FROM public.ratings
GROUP BY reviewee_id;
REVOKE ALL ON public.public_rating_counts FROM PUBLIC, anon;
GRANT SELECT ON public.public_rating_counts TO authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
