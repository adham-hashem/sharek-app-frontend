-- Permit an authenticated user to contact only the owner of a currently
-- available food offer. Existing matched/claimed conversation rules remain.
CREATE OR REPLACE FUNCTION public.can_start_conversation(p_other uuid, p_food uuid DEFAULT NULL, p_request uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND p_other <> auth.uid() AND (
    EXISTS (SELECT 1 FROM public.messages WHERE (sender_id = auth.uid() AND recipient_id = p_other) OR (sender_id = p_other AND recipient_id = auth.uid()))
    OR (p_food IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.food_donations d JOIN public.food_claims fc ON fc.food_donation_id = d.id
      WHERE d.id = p_food AND ((d.user_id = auth.uid() AND fc.claimer_id = p_other) OR (d.user_id = p_other AND fc.claimer_id = auth.uid()))
    ))
    OR (p_food IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.food_donations d
      WHERE d.id = p_food AND d.user_id = p_other AND d.status = 'available'
        AND d.expires_at > now() AND d.meals > 0
    ))
    OR (p_request IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.meal_requests r JOIN public.matches mt ON mt.request_id = r.id
      WHERE r.id = p_request AND ((r.user_id = auth.uid() AND mt.helper_id = p_other) OR (r.user_id = p_other AND mt.helper_id = auth.uid()))
    ))
  );
$$;
REVOKE ALL ON FUNCTION public.can_start_conversation(uuid, uuid, uuid) FROM PUBLIC, anon;
