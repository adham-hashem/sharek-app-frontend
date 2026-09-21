BEGIN;

CREATE TABLE IF NOT EXISTS public.helper_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  receives_nearby_requests boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT false,
  radius_km integer NOT NULL DEFAULT 5 CHECK (radius_km IN (1, 3, 5, 10)),
  latitude double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  location_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.helper_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS helper_preferences_own_read ON public.helper_preferences;
CREATE POLICY helper_preferences_own_read ON public.helper_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS helper_preferences_own_insert ON public.helper_preferences;
CREATE POLICY helper_preferences_own_insert ON public.helper_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS helper_preferences_own_update ON public.helper_preferences;
CREATE POLICY helper_preferences_own_update ON public.helper_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.helper_preferences FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.helper_preferences TO authenticated;
CREATE INDEX IF NOT EXISTS helper_preferences_discovery_idx
  ON public.helper_preferences (is_available, receives_nearby_requests, location_updated_at DESC);

CREATE OR REPLACE FUNCTION public.upsert_helper_preferences(
  p_receives boolean,
  p_available boolean,
  p_radius_km integer,
  p_latitude double precision,
  p_longitude double precision
) RETURNS public.helper_preferences
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result public.helper_preferences;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_radius_km NOT IN (1, 3, 5, 10) THEN RAISE EXCEPTION 'Invalid radius'; END IF;
  IF p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('donor','charity','restaurant','hotel') OR mode = 'donor')) THEN
    RAISE EXCEPTION 'Only helpers can enable nearby requests';
  END IF;
  INSERT INTO public.helper_preferences(user_id, receives_nearby_requests, is_available, radius_km, latitude, longitude, location_updated_at)
  VALUES (auth.uid(), p_receives, p_available, p_radius_km, p_latitude, p_longitude, now())
  ON CONFLICT (user_id) DO UPDATE SET receives_nearby_requests = EXCLUDED.receives_nearby_requests,
    is_available = EXCLUDED.is_available, radius_km = EXCLUDED.radius_km,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    location_updated_at = now(), updated_at = now()
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_helper_preferences(boolean, boolean, integer, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_helper_preferences(boolean, boolean, integer, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_eligible_helpers_for_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, data)
  SELECT hp.user_id, 'nearby_meal_request', '🍱 طلب وجبة قريب منك',
    'شخص قريب منك يحتاج ' || NEW.meals || ' وجبة',
    jsonb_build_object('meal_request_id', NEW.id, 'meals', NEW.meals, 'timing', NEW.timing)
  FROM public.helper_preferences hp
  WHERE hp.receives_nearby_requests AND hp.is_available
    AND hp.user_id <> NEW.user_id
    AND hp.location_updated_at > now() - interval '15 minutes'
    AND hp.latitude IS NOT NULL AND hp.longitude IS NOT NULL
    AND 6371 * 2 * asin(sqrt(
      power(sin(radians(NEW.latitude - hp.latitude) / 2), 2) +
      cos(radians(hp.latitude)) * cos(radians(NEW.latitude)) *
      power(sin(radians(NEW.longitude - hp.longitude) / 2), 2)
    )) <= hp.radius_km;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meal_request_notify_eligible_helpers ON public.meal_requests;
CREATE TRIGGER meal_request_notify_eligible_helpers
AFTER INSERT ON public.meal_requests FOR EACH ROW
WHEN (NEW.status = 'open') EXECUTE FUNCTION public.notify_eligible_helpers_for_request();

-- Atomic first-accept wins, with server-side range/consent enforcement.
CREATE OR REPLACE FUNCTION public.accept_meal_request(p_request_id uuid, p_helper_lat double precision DEFAULT NULL, p_helper_lng double precision DEFAULT NULL)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_match public.matches; v_request public.meal_requests; v_pref public.helper_preferences; v_distance double precision;
BEGIN
  SELECT * INTO v_request FROM public.meal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'open' THEN RAISE EXCEPTION 'Request is no longer open'; END IF;
  IF v_request.user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot accept your own request'; END IF;
  SELECT * INTO v_pref FROM public.helper_preferences WHERE user_id = auth.uid();
  IF NOT FOUND OR NOT v_pref.receives_nearby_requests OR NOT v_pref.is_available
     OR v_pref.location_updated_at < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Helper is not available for nearby requests';
  END IF;
  v_distance := 6371 * 2 * asin(sqrt(
    power(sin(radians(v_request.latitude - v_pref.latitude) / 2), 2) +
    cos(radians(v_pref.latitude)) * cos(radians(v_request.latitude)) *
    power(sin(radians(v_request.longitude - v_pref.longitude) / 2), 2)
  ));
  IF v_distance > v_pref.radius_km THEN RAISE EXCEPTION 'Request is outside helper range'; END IF;
  INSERT INTO public.matches(request_id, helper_id, status, delivery_status, helper_lat, helper_lng, helper_location_updated_at, requester_lat, requester_lng, requester_location_updated_at)
  VALUES (p_request_id, auth.uid(), 'accepted', 'accepted', COALESCE(p_helper_lat, v_pref.latitude), COALESCE(p_helper_lng, v_pref.longitude), now(), v_request.latitude, v_request.longitude, now())
  RETURNING * INTO v_match;
  UPDATE public.meal_requests SET status = 'matched', updated_at = now() WHERE id = p_request_id;
  UPDATE public.offers SET status = 'declined', updated_at = now() WHERE request_id = p_request_id AND status = 'pending';
  DELETE FROM public.notifications WHERE type = 'nearby_meal_request' AND data->>'meal_request_id' = p_request_id::text AND user_id <> auth.uid();
  RETURN v_match;
END; $$;
REVOKE ALL ON FUNCTION public.accept_meal_request(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_meal_request(uuid, double precision, double precision) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'helper_preferences') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.helper_preferences;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
