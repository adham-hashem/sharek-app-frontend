/*
# InDrive-style live meal request system

1. Schema: add helper_lat, helper_lng, helper_location_updated_at to matches.

2. Update accept_meal_request to accept helper coordinates (overloaded).

3. New RPC: update_helper_location — helper pushes GPS to active match.

4. New RPC: expire_stale_requests — cancels open requests older than 60s.
*/

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS helper_lat double precision,
  ADD COLUMN IF NOT EXISTS helper_lng double precision,
  ADD COLUMN IF NOT EXISTS helper_location_updated_at timestamptz;

-- 3-param version (with helper coordinates)
CREATE OR REPLACE FUNCTION public.accept_meal_request(
  p_request_id uuid,
  p_helper_lat double precision DEFAULT NULL,
  p_helper_lng double precision DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_request_user_id uuid;
  v_request_status text;
BEGIN
  SELECT user_id, status INTO v_request_user_id, v_request_status
  FROM public.meal_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meal request not found';
  END IF;

  IF v_request_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot accept your own request';
  END IF;

  IF v_request_status != 'open' THEN
    RAISE EXCEPTION 'Request is no longer open';
  END IF;

  INSERT INTO public.matches (request_id, helper_id, status, delivery_status, helper_lat, helper_lng, helper_location_updated_at)
  VALUES (p_request_id, auth.uid(), 'accepted', 'accepted', p_helper_lat, p_helper_lng, now())
  RETURNING * INTO v_match;

  UPDATE public.meal_requests
  SET status = 'matched', updated_at = now()
  WHERE id = p_request_id;

  RETURN v_match;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_meal_request(uuid, double precision, double precision) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_meal_request(uuid, double precision, double precision) FROM anon;

-- update_helper_location RPC
CREATE OR REPLACE FUNCTION public.update_helper_location(
  p_match_id uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET helper_lat = p_lat,
      helper_lng = p_lng,
      helper_location_updated_at = now()
  WHERE id = p_match_id
    AND helper_id = auth.uid()
    AND status = 'accepted';
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_helper_location(uuid, double precision, double precision) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_helper_location(uuid, double precision, double precision) FROM anon;

-- expire_stale_requests RPC
CREATE OR REPLACE FUNCTION public.expire_stale_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.meal_requests
  SET status = 'cancelled', updated_at = now()
  WHERE status = 'open'
    AND created_at < now() - interval '60 seconds';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_requests() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_requests() FROM anon;
