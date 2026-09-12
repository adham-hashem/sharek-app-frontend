/* Production hardening for matching, live location, pricing and reviews. */

-- A request has a long search window; each donor offer has its own 15-second window.
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS response_expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 seconds');
CREATE INDEX IF NOT EXISTS offers_pending_expiry_idx ON public.offers(request_id, status, response_expires_at);

-- Both sides can publish live coordinates while a match is active.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS requester_lat double precision,
  ADD COLUMN IF NOT EXISTS requester_lng double precision,
  ADD COLUMN IF NOT EXISTS requester_location_updated_at timestamptz;

ALTER TABLE public.food_donations
  ADD COLUMN IF NOT EXISTS food_type text,
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_method text,
  ADD COLUMN IF NOT EXISTS allergens text;
ALTER TABLE public.food_claims
  ADD COLUMN IF NOT EXISTS claimer_lat double precision,
  ADD COLUMN IF NOT EXISTS claimer_lng double precision,
  ADD COLUMN IF NOT EXISTS claimer_location_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS meal_requests_open_geo_idx ON public.meal_requests(status, latitude, longitude);
CREATE INDEX IF NOT EXISTS food_donations_available_geo_idx ON public.food_donations(status, expires_at, latitude, longitude);
CREATE INDEX IF NOT EXISTS matches_request_idx ON public.matches(request_id, created_at DESC);

-- Do not expose private contact fields (email/phone) to every signed-in user.
-- The app uses this narrow view for matched-user display data; account reads
-- continue to use the owner-scoped profiles policy below.
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, full_name, role, language, avatar_url, rating, meals_helped, meals_received, created_at, updated_at
  FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated;

DROP POLICY IF EXISTS food_donations_insert_own ON public.food_donations;
CREATE POLICY food_donations_insert_own ON public.food_donations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('donor', 'charity', 'restaurant', 'hotel')));
DROP POLICY IF EXISTS offers_insert_own ON public.offers;
CREATE POLICY offers_insert_own ON public.offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = helper_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('donor', 'charity', 'restaurant', 'hotel')));

-- Prevent a second claimant from booking an already reserved offer and record
-- the first location only for the active claim.
DROP FUNCTION IF EXISTS public.claim_food_donation(uuid);
CREATE OR REPLACE FUNCTION public.claim_food_donation(p_donation_id uuid, p_claimer_lat double precision DEFAULT NULL, p_claimer_lng double precision DEFAULT NULL)
RETURNS public.food_claims LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_claim public.food_claims; v_owner uuid; v_status text; v_expiry timestamptz;
BEGIN
  SELECT user_id, status, expires_at INTO v_owner, v_status, v_expiry FROM public.food_donations WHERE id = p_donation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Food donation not found'; END IF;
  IF v_owner = auth.uid() THEN RAISE EXCEPTION 'Cannot claim your own donation'; END IF;
  IF v_status <> 'available' OR v_expiry <= now() THEN RAISE EXCEPTION 'This food is no longer available'; END IF;
  IF p_claimer_lat IS NOT NULL AND (p_claimer_lat < -90 OR p_claimer_lat > 90) THEN RAISE EXCEPTION 'Invalid latitude'; END IF;
  IF p_claimer_lng IS NOT NULL AND (p_claimer_lng < -180 OR p_claimer_lng > 180) THEN RAISE EXCEPTION 'Invalid longitude'; END IF;
  INSERT INTO public.food_claims(food_donation_id, claimer_id, claimer_lat, claimer_lng, claimer_location_updated_at)
    VALUES (p_donation_id, auth.uid(), p_claimer_lat, p_claimer_lng, now()) RETURNING * INTO v_claim;
  UPDATE public.food_donations SET status = 'claimed', updated_at = now() WHERE id = p_donation_id;
  RETURN v_claim;
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_food_donation(uuid, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_food_donation(uuid, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_food_claim_location(p_claim_id uuid, p_lat double precision, p_lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
  UPDATE public.food_claims SET claimer_lat = p_lat, claimer_lng = p_lng, claimer_location_updated_at = now()
  WHERE id = p_claim_id AND claimer_id = auth.uid() AND status = 'booked';
END; $$;
REVOKE EXECUTE ON FUNCTION public.update_food_claim_location(uuid, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_food_claim_location(uuid, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_food_claim_pickup(p_claim_id uuid)
RETURNS public.food_claims LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_claim public.food_claims;
BEGIN
  UPDATE public.food_claims SET status = 'completed' WHERE id = p_claim_id AND claimer_id = auth.uid() AND status = 'booked' RETURNING * INTO v_claim;
  IF NOT FOUND THEN RAISE EXCEPTION 'Food claim is not active'; END IF;
  RETURN v_claim;
END; $$;
REVOKE EXECUTE ON FUNCTION public.confirm_food_claim_pickup(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_food_claim_pickup(uuid) TO authenticated;

DROP POLICY IF EXISTS claims_update_own ON public.food_claims;

CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id uuid)
RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_offer public.offers;
  v_request public.meal_requests;
  v_match public.matches;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  SELECT * INTO v_request FROM public.meal_requests WHERE id = v_offer.request_id FOR UPDATE;
  IF NOT FOUND OR v_request.user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the requester can accept an offer'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_offer.helper_id AND role IN ('donor', 'charity', 'restaurant', 'hotel')) THEN RAISE EXCEPTION 'Invalid donor'; END IF;
  IF v_request.status <> 'open' OR v_offer.status <> 'pending' OR v_offer.response_expires_at <= now() THEN RAISE EXCEPTION 'Offer is no longer available'; END IF;

  UPDATE public.offers SET status = 'accepted', updated_at = now() WHERE id = p_offer_id;
  UPDATE public.offers SET status = 'declined', updated_at = now()
    WHERE request_id = v_offer.request_id AND id <> p_offer_id AND status = 'pending';
  UPDATE public.meal_requests SET status = 'matched', updated_at = now() WHERE id = v_request.id;
  INSERT INTO public.matches (request_id, helper_id, helper_lat, helper_lng, helper_location_updated_at, requester_lat, requester_lng, requester_location_updated_at)
    VALUES (v_request.id, v_offer.helper_id, v_offer.latitude, v_offer.longitude, now(), v_request.latitude, v_request.longitude, now())
    RETURNING * INTO v_match;
  RETURN v_match;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_offer(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_meal_request(p_request_id uuid, p_helper_lat double precision DEFAULT NULL, p_helper_lng double precision DEFAULT NULL)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_match public.matches; v_request public.meal_requests;
BEGIN
  SELECT * INTO v_request FROM public.meal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'open' THEN RAISE EXCEPTION 'Request is no longer open'; END IF;
  IF v_request.user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot accept your own request'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('donor', 'charity', 'restaurant', 'hotel')) THEN RAISE EXCEPTION 'Only donors can accept requests'; END IF;
  INSERT INTO public.matches(request_id, helper_id, status, delivery_status, helper_lat, helper_lng, helper_location_updated_at, requester_lat, requester_lng, requester_location_updated_at)
    VALUES (p_request_id, auth.uid(), 'accepted', 'accepted', p_helper_lat, p_helper_lng, now(), v_request.latitude, v_request.longitude, now()) RETURNING * INTO v_match;
  UPDATE public.meal_requests SET status = 'matched', updated_at = now() WHERE id = p_request_id;
  UPDATE public.offers SET status = 'declined', updated_at = now()
    WHERE request_id = p_request_id AND status = 'pending';
  RETURN v_match;
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_meal_request(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_meal_request(uuid, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_meal_request(uuid, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_requester_location(p_match_id uuid, p_lat double precision, p_lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
  UPDATE public.matches m SET requester_lat = p_lat, requester_lng = p_lng, requester_location_updated_at = now()
  WHERE m.id = p_match_id AND m.status = 'accepted'
    AND EXISTS (SELECT 1 FROM public.meal_requests r WHERE r.id = m.request_id AND r.user_id = auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_requester_location(uuid, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_requester_location(uuid, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_match_receipt(p_match_id uuid)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_match public.matches;
BEGIN
  SELECT m.* INTO v_match FROM public.matches m JOIN public.meal_requests r ON r.id = m.request_id
    WHERE m.id = p_match_id AND r.user_id = auth.uid() AND m.status = 'accepted'
      AND m.delivery_status = 'delivered' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match is not ready for receipt confirmation'; END IF;
  UPDATE public.matches SET delivery_status = 'delivered', status = 'completed' WHERE id = p_match_id RETURNING * INTO v_match;
  UPDATE public.meal_requests SET status = 'fulfilled', updated_at = now() WHERE id = v_match.request_id;
  RETURN v_match;
END; $$;
GRANT EXECUTE ON FUNCTION public.confirm_match_receipt(uuid) TO authenticated;

-- Delivery is not complete until the requester confirms receipt. This replaces
-- the earlier helper RPC behavior that completed the match immediately.
CREATE OR REPLACE FUNCTION public.update_delivery_status(p_match_id uuid, p_status text)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_match public.matches;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.helper_id <> auth.uid() OR v_match.status <> 'accepted' THEN RAISE EXCEPTION 'Match is not active'; END IF;
  IF p_status NOT IN ('accepted', 'awaiting_pickup', 'delivered') THEN RAISE EXCEPTION 'Invalid delivery status'; END IF;
  IF p_status = 'awaiting_pickup' AND v_match.delivery_status <> 'accepted' THEN RAISE EXCEPTION 'Invalid delivery transition'; END IF;
  IF p_status = 'delivered' AND v_match.delivery_status <> 'awaiting_pickup' THEN RAISE EXCEPTION 'Invalid delivery transition'; END IF;
  UPDATE public.matches SET delivery_status = p_status WHERE id = p_match_id RETURNING * INTO v_match;
  RETURN v_match;
END; $$;
REVOKE EXECUTE ON FUNCTION public.update_delivery_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_delivery_status(uuid, text) TO authenticated;

-- Nearby data is bounded and indexed by status/expiry. Exact distance is calculated in SQL.
CREATE OR REPLACE FUNCTION public.get_nearby_map_items(p_lat double precision, p_lng double precision, p_radius_km double precision DEFAULT 25)
RETURNS TABLE(item_type text, item_id uuid, title text, meals integer, latitude double precision, longitude double precision, expires_at timestamptz, created_at timestamptz, distance_km double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT *
  FROM (
    SELECT 'request'::text AS item_type, r.id AS item_id, 'Meal request'::text AS title, r.meals, r.latitude, r.longitude, NULL::timestamptz AS expires_at, r.created_at,
      6371 * 2 * asin(sqrt(power(sin(radians(r.latitude - p_lat) / 2), 2) + cos(radians(p_lat)) * cos(radians(r.latitude)) * power(sin(radians(r.longitude - p_lng) / 2), 2))) AS distance_km
    FROM public.meal_requests r
    WHERE r.status = 'open'
      AND r.latitude BETWEEN p_lat - (p_radius_km / 111.0) AND p_lat + (p_radius_km / 111.0)
      AND r.longitude BETWEEN p_lng - (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.1))) AND p_lng + (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.1)))
    UNION ALL
    SELECT 'food'::text AS item_type, f.id AS item_id, f.food_name AS title, f.meals, f.latitude, f.longitude, f.expires_at, f.created_at,
      6371 * 2 * asin(sqrt(power(sin(radians(f.latitude - p_lat) / 2), 2) + cos(radians(p_lat)) * cos(radians(f.latitude)) * power(sin(radians(f.longitude - p_lng) / 2), 2))) AS distance_km
    FROM public.food_donations f
    WHERE f.status = 'available' AND f.expires_at > now()
      AND f.latitude BETWEEN p_lat - (p_radius_km / 111.0) AND p_lat + (p_radius_km / 111.0)
      AND f.longitude BETWEEN p_lng - (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.1))) AND p_lng + (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.1)))
  ) nearby_items
  ORDER BY nearby_items.distance_km ASC
  LIMIT 200;
$$;
GRANT EXECUTE ON FUNCTION public.get_nearby_map_items(double precision, double precision, double precision) TO authenticated;

-- Global meal prices and explicit exchange rates; donations snapshot all financial values.
CREATE TABLE IF NOT EXISTS public.meal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  price_usd numeric(12,2) NOT NULL CHECK (price_usd > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.currency_rates (
  currency text PRIMARY KEY CHECK (currency = upper(currency) AND char_length(currency) = 3),
  rate numeric(18,8) NOT NULL CHECK (rate > 0),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.meal_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_type_id uuid NOT NULL REFERENCES public.meal_types(id) ON DELETE CASCADE,
  old_price_usd numeric(12,2),
  new_price_usd numeric(12,2) NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meal_price_history_changed_idx ON public.meal_price_history(changed_at DESC);
ALTER TABLE public.app_donations
  ADD COLUMN IF NOT EXISTS meal_type_id uuid REFERENCES public.meal_types(id),
  ADD COLUMN IF NOT EXISTS meal_price_usd numeric(12,2),
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(18,8),
  ADD COLUMN IF NOT EXISTS local_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS target_type text CHECK (target_type IN ('general', 'request', 'charity')),
  ADD COLUMN IF NOT EXISTS target_request_id uuid REFERENCES public.meal_requests(id),
  ADD COLUMN IF NOT EXISTS target_charity_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'recorded')),
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('card', 'wallet')),
  ADD COLUMN IF NOT EXISTS payment_reference text;
CREATE INDEX IF NOT EXISTS meal_types_active_idx ON public.meal_types(is_active, price_usd);
CREATE INDEX IF NOT EXISTS donations_target_request_idx ON public.app_donations(target_request_id) WHERE target_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS donations_target_charity_idx ON public.app_donations(target_charity_id) WHERE target_charity_id IS NOT NULL;

ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meal_types_read_active ON public.meal_types;
CREATE POLICY meal_types_read_active ON public.meal_types FOR SELECT TO authenticated USING (
  is_active OR (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
DROP POLICY IF EXISTS currency_rates_read ON public.currency_rates;
CREATE POLICY currency_rates_read ON public.currency_rates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS price_history_admin_read ON public.meal_price_history;
CREATE POLICY price_history_admin_read ON public.meal_price_history FOR SELECT TO authenticated USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
DROP POLICY IF EXISTS meal_types_admin_write ON public.meal_types;
CREATE POLICY meal_types_admin_write ON public.meal_types FOR ALL TO authenticated USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
) WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
DROP POLICY IF EXISTS currency_rates_admin_write ON public.currency_rates;
CREATE POLICY currency_rates_admin_write ON public.currency_rates FOR ALL TO authenticated USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
) WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

CREATE OR REPLACE FUNCTION public.record_meal_price_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.price_usd IS DISTINCT FROM OLD.price_usd THEN
    INSERT INTO public.meal_price_history(meal_type_id, old_price_usd, new_price_usd, changed_by) VALUES (NEW.id, OLD.price_usd, NEW.price_usd, auth.uid());
  END IF;
  NEW.updated_at := now(); RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS meal_types_audit_price ON public.meal_types;
CREATE TRIGGER meal_types_audit_price BEFORE UPDATE ON public.meal_types FOR EACH ROW EXECUTE FUNCTION public.record_meal_price_change();

INSERT INTO public.meal_types(name, description, price_usd) SELECT 'Basic meal', 'A nutritious basic meal', 5 WHERE NOT EXISTS (SELECT 1 FROM public.meal_types);
INSERT INTO public.meal_types(name, description, price_usd) SELECT 'Full meal', 'A complete meal with protein', 8 WHERE NOT EXISTS (SELECT 1 FROM public.meal_types WHERE lower(name) = 'full meal');
INSERT INTO public.meal_types(name, description, price_usd) SELECT 'Family meal', 'A meal serving a family', 20 WHERE NOT EXISTS (SELECT 1 FROM public.meal_types WHERE lower(name) = 'family meal');
INSERT INTO public.currency_rates(currency, rate) VALUES ('USD', 1) ON CONFLICT (currency) DO NOTHING;

-- A rating can only be submitted by a completed match participant, once per match.
CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, reviewer_id)
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ratings_reviewee_idx ON public.ratings(reviewee_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.submit_rating(p_match_id uuid, p_score integer, p_comment text DEFAULT NULL)
RETURNS public.ratings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_match public.matches; v_reviewee uuid; v_rating public.ratings;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id AND status = 'completed' FOR SHARE;
  IF NOT FOUND OR v_match.helper_id <> auth.uid() AND NOT EXISTS (SELECT 1 FROM public.meal_requests WHERE id = v_match.request_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Match is not eligible for rating'; END IF;
  SELECT CASE WHEN v_match.helper_id = auth.uid() THEN r.user_id ELSE v_match.helper_id END INTO v_reviewee FROM public.meal_requests r WHERE r.id = v_match.request_id;
  INSERT INTO public.ratings(match_id, reviewer_id, reviewee_id, score, comment) VALUES (p_match_id, auth.uid(), v_reviewee, p_score, nullif(trim(p_comment), '')) RETURNING * INTO v_rating;
  UPDATE public.profiles SET rating = (SELECT round(avg(score)::numeric, 2) FROM public.ratings WHERE reviewee_id = v_reviewee), updated_at = now() WHERE id = v_reviewee;
  RETURN v_rating;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_rating(uuid, integer, text) TO authenticated;
CREATE POLICY ratings_read_participants ON public.ratings FOR SELECT TO authenticated USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());

-- Financial writes must go through server-validated functions. Direct client inserts
-- could otherwise forge snapshots or mark a donation as recorded/paid.
DROP POLICY IF EXISTS "app_donations_insert_own" ON public.app_donations;
CREATE OR REPLACE FUNCTION public.create_meal_donation_intent(
  p_meal_type_id uuid,
  p_meal_count integer,
  p_currency text,
  p_target_type text DEFAULT 'general',
  p_target_request_id uuid DEFAULT NULL,
  p_target_charity_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'card'
)
RETURNS public.app_donations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_price numeric(12,2);
  v_rate numeric(18,8);
  v_amount numeric(12,2);
  v_donation public.app_donations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_meal_count IS NULL OR p_meal_count < 1 OR p_meal_count > 1000 THEN RAISE EXCEPTION 'Invalid meal count'; END IF;
  IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Invalid currency'; END IF;
  IF p_payment_method NOT IN ('card', 'wallet') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF p_target_type NOT IN ('general', 'request', 'charity') THEN RAISE EXCEPTION 'Invalid donation target'; END IF;
  IF p_target_type = 'request' AND p_target_request_id IS NULL THEN RAISE EXCEPTION 'A target request is required'; END IF;
  IF p_target_type <> 'request' AND p_target_request_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid target request'; END IF;
  IF p_target_type = 'charity' AND p_target_charity_id IS NULL THEN RAISE EXCEPTION 'A target charity is required'; END IF;
  IF p_target_type <> 'charity' AND p_target_charity_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid target charity'; END IF;
  IF p_target_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.meal_requests WHERE id = p_target_request_id AND status = 'open' AND user_id <> auth.uid()) THEN RAISE EXCEPTION 'Target request is no longer open'; END IF;
  IF p_target_charity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_charity_id AND role = 'charity') THEN RAISE EXCEPTION 'Target charity is invalid'; END IF;
  SELECT price_usd INTO v_price FROM public.meal_types WHERE id = p_meal_type_id AND is_active = true;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Meal type is not configured'; END IF;
  IF p_currency = 'USD' THEN v_rate := 1; ELSE SELECT rate INTO v_rate FROM public.currency_rates WHERE currency = p_currency; END IF;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Currency is not configured'; END IF;
  v_amount := round(v_price * p_meal_count * v_rate, 2);
  INSERT INTO public.app_donations(user_id, amount, currency, donation_type, meal_price, meal_count, meal_type_id, meal_price_usd, exchange_rate, local_amount, target_type, target_request_id, target_charity_id, payment_status, payment_method)
    VALUES (auth.uid(), v_amount, p_currency, 'meals', round(v_amount / p_meal_count, 2), p_meal_count, p_meal_type_id, v_price, v_rate, v_amount, p_target_type, p_target_request_id, p_target_charity_id, 'pending', p_payment_method)
    RETURNING * INTO v_donation;
  RETURN v_donation;
END; $$;
REVOKE ALL ON FUNCTION public.create_meal_donation_intent(uuid, integer, text, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_meal_donation_intent(uuid, integer, text, text, uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_general_donation_intent(
  p_amount numeric,
  p_currency text,
  p_payment_method text DEFAULT 'card'
)
RETURNS public.app_donations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rate numeric(18,8); v_donation public.app_donations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Invalid currency'; END IF;
  IF p_payment_method NOT IN ('card', 'wallet') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF p_currency = 'USD' THEN v_rate := 1; ELSE SELECT rate INTO v_rate FROM public.currency_rates WHERE currency = p_currency; END IF;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Currency is not configured'; END IF;
  INSERT INTO public.app_donations(user_id, amount, currency, donation_type, payment_status, payment_method, local_amount, exchange_rate)
    VALUES (auth.uid(), round(p_amount, 2), p_currency, 'general', 'pending', p_payment_method, round(p_amount, 2), v_rate)
    RETURNING * INTO v_donation;
  RETURN v_donation;
END; $$;
REVOKE ALL ON FUNCTION public.create_general_donation_intent(numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_general_donation_intent(numeric, text, text) TO authenticated;

-- Messages must belong to a real matched/claimed pair, not merely an arbitrary sender.
DROP POLICY IF EXISTS messages_read_participants ON public.messages;
DROP POLICY IF EXISTS messages_insert_sender ON public.messages;
DROP POLICY IF EXISTS messages_update_recipient_read ON public.messages;
DROP POLICY IF EXISTS select_own_meal_request_messages ON public.messages;
DROP POLICY IF EXISTS insert_own_meal_request_messages ON public.messages;
DROP POLICY IF EXISTS update_own_meal_request_messages ON public.messages;
CREATE POLICY messages_read_secure ON public.messages FOR SELECT TO authenticated USING (
  (sender_id = auth.uid() OR recipient_id = auth.uid()) AND (
    (meal_request_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.meal_requests r LEFT JOIN public.matches m ON m.request_id = r.id AND m.status IN ('accepted', 'completed') WHERE r.id = messages.meal_request_id AND ((sender_id = r.user_id AND recipient_id = m.helper_id) OR (recipient_id = r.user_id AND sender_id = m.helper_id))))
    OR (food_donation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.food_donations d JOIN public.food_claims c ON c.food_donation_id = d.id AND c.status IN ('booked', 'completed') WHERE d.id = messages.food_donation_id AND ((sender_id = d.user_id AND recipient_id = c.claimer_id) OR (recipient_id = d.user_id AND sender_id = c.claimer_id))))
  )
);
CREATE POLICY messages_insert_secure ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND recipient_id <> auth.uid() AND (
    (meal_request_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.meal_requests r LEFT JOIN public.matches m ON m.request_id = r.id AND m.status IN ('accepted', 'completed') WHERE r.id = messages.meal_request_id AND ((sender_id = r.user_id AND recipient_id = m.helper_id) OR (recipient_id = r.user_id AND sender_id = m.helper_id))))
    OR (food_donation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.food_donations d JOIN public.food_claims c ON c.food_donation_id = d.id AND c.status IN ('booked', 'completed') WHERE d.id = messages.food_donation_id AND ((sender_id = d.user_id AND recipient_id = c.claimer_id) OR (recipient_id = d.user_id AND sender_id = c.claimer_id))))
  )
);
-- Message updates are intentionally reduced to a server-side read marker. A
-- recipient must not be able to overwrite body, sender or recipient columns.
DROP POLICY IF EXISTS messages_update_secure ON public.messages;
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.messages AS msg SET read_at = COALESCE(msg.read_at, now())
  WHERE msg.id = p_message_id AND msg.recipient_id = auth.uid() AND (
    (msg.meal_request_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.meal_requests r JOIN public.matches m ON m.request_id = r.id
      WHERE r.id = msg.meal_request_id AND m.status IN ('accepted', 'completed')
    ))
    OR (msg.food_donation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.food_donations d JOIN public.food_claims c ON c.food_donation_id = d.id
      WHERE d.id = msg.food_donation_id AND c.status IN ('booked', 'completed')
    ))
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.mark_message_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated;
