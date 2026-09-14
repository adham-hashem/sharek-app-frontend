BEGIN;

ALTER TABLE public.food_donations
  ADD COLUMN IF NOT EXISTS claimer_lat double precision,
  ADD COLUMN IF NOT EXISTS claimer_lng double precision,
  ADD COLUMN IF NOT EXISTS claimer_location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS donor_lat double precision,
  ADD COLUMN IF NOT EXISTS donor_lng double precision,
  ADD COLUMN IF NOT EXISTS donor_location_updated_at timestamptz;

DROP FUNCTION IF EXISTS public.get_nearby_request_details(uuid[]);
CREATE OR REPLACE FUNCTION public.get_nearby_request_details(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  user_id uuid,
  meals integer,
  timing text,
  status text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.user_id, r.meals, r.timing, r.status,
    round(r.latitude::numeric, 3)::double precision AS latitude,
    round(r.longitude::numeric, 3)::double precision AS longitude,
    r.created_at, r.updated_at
  FROM public.meal_requests r
  WHERE r.id = ANY(p_ids)
    AND r.status = 'open'
    AND r.created_at > now() - interval '30 minutes';
$$;

REVOKE EXECUTE ON FUNCTION public.get_nearby_request_details(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_request_details(uuid[]) TO authenticated;

DROP FUNCTION IF EXISTS public.get_nearby_food_details(uuid[]);
CREATE OR REPLACE FUNCTION public.get_nearby_food_details(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  user_id uuid,
  food_name text,
  description text,
  image_url text,
  meals integer,
  pickup_start timestamptz,
  pickup_end timestamptz,
  expires_at timestamptz,
  status text,
  latitude double precision,
  longitude double precision,
  claimer_lat double precision,
  claimer_lng double precision,
  claimer_location_updated_at timestamptz,
  donor_lat double precision,
  donor_lng double precision,
  donor_location_updated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  food_type text,
  prepared_at timestamptz,
  storage_method text,
  allergens text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.user_id, f.food_name, f.description, f.image_url, f.meals,
    f.pickup_start, f.pickup_end, f.expires_at, f.status,
    round(f.latitude::numeric, 3)::double precision AS latitude,
    round(f.longitude::numeric, 3)::double precision AS longitude,
    f.claimer_lat, f.claimer_lng, f.claimer_location_updated_at,
    f.donor_lat, f.donor_lng, f.donor_location_updated_at,
    f.created_at, f.updated_at, f.food_type, f.prepared_at,
    f.storage_method, f.allergens
  FROM public.food_donations f
  WHERE f.id = ANY(p_ids)
    AND f.status = 'available'
    AND f.expires_at > now();
$$;

REVOKE EXECUTE ON FUNCTION public.get_nearby_food_details(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_food_details(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
