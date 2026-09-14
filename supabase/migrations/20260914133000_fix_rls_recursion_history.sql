BEGIN;

-- Break RLS recursion between meal_requests, matches, offers, food_claims, and
-- messages. These SECURITY DEFINER helpers run ownership checks without
-- invoking the caller's row policies again.
CREATE OR REPLACE FUNCTION public.is_meal_request_owner(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meal_requests r
    WHERE r.id = p_request_id
      AND r.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_match_participant(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.meal_requests r ON r.id = m.request_id
    WHERE m.id = p_match_id
      AND (m.helper_id = auth.uid() OR r.user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_request_participant(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meal_requests r
    WHERE r.id = p_request_id
      AND r.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.request_id = p_request_id
      AND m.helper_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_food_claim_participant(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.food_claims c
    JOIN public.food_donations d ON d.id = c.food_donation_id
    WHERE c.id = p_claim_id
      AND (c.claimer_id = auth.uid() OR d.user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_food_donation_participant(p_donation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.food_donations d
    WHERE d.id = p_donation_id
      AND d.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.food_claims c
    WHERE c.food_donation_id = p_donation_id
      AND c.claimer_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_meal_request_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_match_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_request_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_food_claim_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_food_donation_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_meal_request_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_match_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_request_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_food_claim_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_food_donation_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS "requests_read_authenticated" ON public.meal_requests;
DROP POLICY IF EXISTS requests_read_scoped ON public.meal_requests;
CREATE POLICY requests_read_scoped ON public.meal_requests
  FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR user_id = auth.uid()
    OR public.is_request_participant(id)
  );

DROP POLICY IF EXISTS "matches_read_participants" ON public.matches;
DROP POLICY IF EXISTS matches_read_participants ON public.matches;
CREATE POLICY matches_read_participants ON public.matches
  FOR SELECT TO authenticated
  USING (public.is_match_participant(id));

DROP POLICY IF EXISTS "offers_read_participants" ON public.offers;
DROP POLICY IF EXISTS offers_read_participants ON public.offers;
CREATE POLICY offers_read_participants ON public.offers
  FOR SELECT TO authenticated
  USING (helper_id = auth.uid() OR public.is_meal_request_owner(request_id));

DROP POLICY IF EXISTS "offers_update_participants" ON public.offers;
DROP POLICY IF EXISTS offers_update_participants ON public.offers;
CREATE POLICY offers_update_participants ON public.offers
  FOR UPDATE TO authenticated
  USING (helper_id = auth.uid() OR public.is_meal_request_owner(request_id))
  WITH CHECK (helper_id = auth.uid() OR public.is_meal_request_owner(request_id));

DROP POLICY IF EXISTS "claims_read_participants" ON public.food_claims;
DROP POLICY IF EXISTS claims_read_participants ON public.food_claims;
CREATE POLICY claims_read_participants ON public.food_claims
  FOR SELECT TO authenticated
  USING (public.is_food_claim_participant(id));

DROP POLICY IF EXISTS "donations_read_authenticated" ON public.food_donations;
DROP POLICY IF EXISTS donations_read_scoped ON public.food_donations;
CREATE POLICY donations_read_scoped ON public.food_donations
  FOR SELECT TO authenticated
  USING (
    (status = 'available' AND expires_at > now())
    OR user_id = auth.uid()
    OR public.is_food_donation_participant(id)
  );

DROP POLICY IF EXISTS "messages_read_participants" ON public.messages;
DROP POLICY IF EXISTS messages_read_participants ON public.messages;
DROP POLICY IF EXISTS messages_read_secure ON public.messages;
DROP POLICY IF EXISTS "select_own_meal_request_messages" ON public.messages;
DROP POLICY IF EXISTS select_own_meal_request_messages ON public.messages;
CREATE POLICY messages_read_participants ON public.messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
DROP POLICY IF EXISTS messages_insert_sender ON public.messages;
DROP POLICY IF EXISTS messages_insert_secure ON public.messages;
DROP POLICY IF EXISTS "insert_own_meal_request_messages" ON public.messages;
DROP POLICY IF EXISTS insert_own_meal_request_messages ON public.messages;
CREATE POLICY messages_insert_sender ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND recipient_id <> auth.uid());

DROP POLICY IF EXISTS "messages_update_recipient_read" ON public.messages;
DROP POLICY IF EXISTS messages_update_recipient_read ON public.messages;
DROP POLICY IF EXISTS messages_update_secure ON public.messages;
DROP POLICY IF EXISTS "update_own_meal_request_messages" ON public.messages;
DROP POLICY IF EXISTS update_own_meal_request_messages ON public.messages;
CREATE POLICY messages_update_recipient_read ON public.messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
DROP POLICY IF EXISTS messages_delete_sender ON public.messages;
DROP POLICY IF EXISTS "delete_own_meal_request_messages" ON public.messages;
DROP POLICY IF EXISTS delete_own_meal_request_messages ON public.messages;
CREATE POLICY messages_delete_sender ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

NOTIFY pgrst, 'reload schema';
COMMIT;
