BEGIN;

ALTER TABLE public.food_donations
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.food_donations
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

DROP FUNCTION IF EXISTS public.get_nearby_food_details(uuid[]);
CREATE OR REPLACE FUNCTION public.get_nearby_food_details(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  user_id uuid,
  food_name text,
  description text,
  image_url text,
  image_urls text[],
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
  SELECT f.id, f.user_id, f.food_name, f.description, f.image_url, f.image_urls, f.meals,
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
