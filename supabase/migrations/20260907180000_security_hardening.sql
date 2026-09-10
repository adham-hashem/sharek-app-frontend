/*
  Security hardening after the production matching migration.

  The mobile client must use the transactional RPCs for matching and must not
  be able to write match rows directly. Public map results expose only coarse
  coordinates; exact coordinates remain available to the owner/participants.
*/

-- Matching is an atomic server-side operation. Remove legacy direct write paths.
DROP POLICY IF EXISTS "matches_insert_helper" ON public.matches;
DROP POLICY IF EXISTS "matches_update_helper" ON public.matches;
REVOKE INSERT, UPDATE, DELETE ON public.matches FROM anon, authenticated;

-- Users can select only their own requests or requests involved in their match.
DROP POLICY IF EXISTS "requests_read_authenticated" ON public.meal_requests;
CREATE POLICY "requests_read_scoped" ON public.meal_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.request_id = meal_requests.id AND m.helper_id = auth.uid()
    )
  );

-- Food rows are visible to their owner, or to a claimer/participant. Nearby
-- public discovery is done through get_nearby_map_items() only.
DROP POLICY IF EXISTS "donations_read_authenticated" ON public.food_donations;
CREATE POLICY "donations_read_scoped" ON public.food_donations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.food_claims c
      WHERE c.food_donation_id = food_donations.id AND c.claimer_id = auth.uid()
    )
  );

-- Self-service role selection is limited to ordinary user roles. Organization
-- roles must be granted by an administrator after verification.
CREATE OR REPLACE FUNCTION public.update_own_profile_role(p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_role NOT IN ('needer', 'donor', 'skipped') THEN
    RAISE EXCEPTION 'Role requires administrator approval';
  END IF;
  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_own_profile_role(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile_role(text) TO authenticated;

-- Return rounded coordinates for map discovery. Exact coordinates are not a
-- public directory and are exchanged only after a match/claim.
DROP FUNCTION IF EXISTS public.get_nearby_map_items(double precision, double precision, double precision);
CREATE FUNCTION public.get_nearby_map_items(
  p_lat double precision, p_lng double precision, p_radius_km double precision DEFAULT 25
)
RETURNS TABLE(item_type text, item_id uuid, title text, meals integer,
  latitude double precision, longitude double precision, expires_at timestamptz,
  created_at timestamptz, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'request'::text, r.id, 'Meal request'::text, r.meals,
    round(r.latitude::numeric, 3)::double precision,
    round(r.longitude::numeric, 3)::double precision,
    NULL::timestamptz, r.created_at,
    6371 * 2 * asin(sqrt(power(sin(radians(r.latitude - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(r.latitude)) * power(sin(radians(r.longitude - p_lng) / 2), 2)))
  FROM public.meal_requests r
  WHERE r.status = 'open' AND r.created_at > now() - interval '10 minutes'
    AND r.latitude BETWEEN p_lat - (p_radius_km / 111.0) AND p_lat + (p_radius_km / 111.0)
    AND r.longitude BETWEEN p_lng - (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.1)))
      AND p_lng + (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.1)))
  UNION ALL
  SELECT 'food'::text, f.id, f.food_name, f.meals,
    round(f.latitude::numeric, 3)::double precision,
    round(f.longitude::numeric, 3)::double precision,
    f.expires_at, f.created_at,
    6371 * 2 * asin(sqrt(power(sin(radians(f.latitude - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(f.latitude)) * power(sin(radians(f.longitude - p_lng) / 2), 2)))
  FROM public.food_donations f
  WHERE f.status = 'available' AND f.expires_at > now()
    AND f.latitude BETWEEN p_lat - (p_radius_km / 111.0) AND p_lat + (p_radius_km / 111.0)
    AND f.longitude BETWEEN p_lng - (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.1)))
      AND p_lng + (p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.1)))
  ORDER BY distance_km ASC LIMIT 200;
$$;
REVOKE EXECUTE ON FUNCTION public.get_nearby_map_items(double precision, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_map_items(double precision, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_nearby_request_details(p_ids uuid[])
RETURNS SETOF public.meal_requests
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.user_id, r.meals, r.timing, r.status,
    round(r.latitude::numeric, 3)::double precision,
    round(r.longitude::numeric, 3)::double precision,
    r.created_at, r.updated_at
  FROM public.meal_requests r
  WHERE r.id = ANY(p_ids) AND r.status = 'open' AND r.created_at > now() - interval '10 minutes';
$$;
GRANT EXECUTE ON FUNCTION public.get_nearby_request_details(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_nearby_food_details(p_ids uuid[])
RETURNS SETOF public.food_donations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.user_id, f.food_name, f.description, f.image_url, f.meals,
    f.pickup_start, f.pickup_end, f.expires_at, f.status,
    round(f.latitude::numeric, 3)::double precision,
    round(f.longitude::numeric, 3)::double precision,
    f.created_at, f.updated_at, f.food_type, f.prepared_at,
    f.storage_method, f.allergens
  FROM public.food_donations f
  WHERE f.id = ANY(p_ids) AND f.status = 'available' AND f.expires_at > now();
$$;
GRANT EXECUTE ON FUNCTION public.get_nearby_food_details(uuid[]) TO authenticated;
