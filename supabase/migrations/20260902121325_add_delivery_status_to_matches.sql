/*
# Add delivery_status to matches table for donor delivery flow

1. Schema Changes
- Add `delivery_status` column to `matches` table:
  'accepted' → 'awaiting_pickup' → 'delivered'
  Default 'accepted' to align with existing match.status='accepted' flow.

2. RPC Function
- `accept_meal_request(p_request_id uuid)`: SECURITY DEFINER function that atomically:
  (a) Checks the request is still 'open' and belongs to a different user.
  (b) Inserts a match row with helper_id = auth.uid().
  (c) Updates the meal_request status to 'matched'.
  (d) Returns the created match row.
- `update_delivery_status(p_match_id uuid, p_status text)`: SECURITY DEFINER function
  that lets the helper (donor) update the delivery_status of their match.

3. Security
- RLS policies for matches already exist from the offers migration.
- The RPC functions are SECURITY DEFINER and granted to authenticated only.

4. Important Notes
- When a donor accepts a request, the request disappears from available listings
  because its status changes to 'matched'.
- The delivery_status flow: 'accepted' → 'awaiting_pickup' → 'delivered'.
- Only the matched helper can update delivery_status.
*/

-- Add delivery_status column to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'accepted'
  CHECK (delivery_status IN ('accepted', 'awaiting_pickup', 'delivered'));

-- accept_meal_request RPC
CREATE OR REPLACE FUNCTION public.accept_meal_request(p_request_id uuid)
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

  INSERT INTO public.matches (request_id, helper_id, status, delivery_status)
  VALUES (p_request_id, auth.uid(), 'accepted', 'accepted')
  RETURNING * INTO v_match;

  UPDATE public.meal_requests
  SET status = 'matched', updated_at = now()
  WHERE id = p_request_id;

  RETURN v_match;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_meal_request FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_meal_request TO authenticated;

-- update_delivery_status RPC
CREATE OR REPLACE FUNCTION public.update_delivery_status(p_match_id uuid, p_status text)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match public.matches;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.helper_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the helper can update delivery status';
  END IF;

  IF p_status NOT IN ('accepted', 'awaiting_pickup', 'delivered') THEN
    RAISE EXCEPTION 'Invalid delivery status';
  END IF;

  UPDATE public.matches
  SET delivery_status = p_status
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  IF p_status = 'delivered' THEN
    UPDATE public.matches SET status = 'completed' WHERE id = p_match_id;
    UPDATE public.meal_requests SET status = 'fulfilled', updated_at = now()
    WHERE id = v_match.request_id;
  END IF;

  RETURN v_match;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_delivery_status FROM anon;
GRANT EXECUTE ON FUNCTION public.update_delivery_status TO authenticated;

-- Add matches to realtime (may already be there)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
