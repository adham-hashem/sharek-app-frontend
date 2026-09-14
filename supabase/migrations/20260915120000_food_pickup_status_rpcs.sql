BEGIN;

-- Align persisted food pickup states with the application workflow:
-- available -> claimed -> ready_for_pickup -> completed.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.food_donations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.food_donations DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.food_donations
  ADD CONSTRAINT food_donations_status_check
  CHECK (status IN ('available', 'claimed', 'ready_for_pickup', 'received', 'completed', 'expired', 'rated'));

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.food_claims'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.food_claims DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.food_claims
  ADD CONSTRAINT food_claims_status_check
  CHECK (status IN ('booked', 'ready_for_pickup', 'received', 'completed', 'cancelled'));

CREATE OR REPLACE FUNCTION public.mark_food_ready_for_pickup(p_donation_id uuid)
RETURNS public.food_donations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_donation public.food_donations;
BEGIN
  SELECT *
  INTO v_donation
  FROM public.food_donations
  WHERE id = p_donation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Food donation not found';
  END IF;

  IF v_donation.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the donor can mark this food ready for pickup';
  END IF;

  IF v_donation.status <> 'claimed' THEN
    RAISE EXCEPTION 'Food donation is not in claimed status';
  END IF;

  UPDATE public.food_donations
  SET status = 'ready_for_pickup', updated_at = now()
  WHERE id = p_donation_id
  RETURNING * INTO v_donation;

  UPDATE public.food_claims
  SET status = 'ready_for_pickup'
  WHERE food_donation_id = p_donation_id
    AND status = 'booked';

  RETURN v_donation;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_food_ready_for_pickup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_food_ready_for_pickup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_food_received(p_donation_id uuid)
RETURNS public.food_donations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_donation public.food_donations;
  v_claim public.food_claims;
BEGIN
  SELECT *
  INTO v_donation
  FROM public.food_donations
  WHERE id = p_donation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Food donation not found';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.food_claims
  WHERE food_donation_id = p_donation_id
    AND claimer_id = auth.uid()
    AND status = 'ready_for_pickup'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the active claimer can confirm receipt';
  END IF;

  IF v_donation.status <> 'ready_for_pickup' THEN
    RAISE EXCEPTION 'Food donation is not ready for pickup';
  END IF;

  UPDATE public.food_claims
  SET status = 'completed'
  WHERE id = v_claim.id;

  UPDATE public.food_donations
  SET status = 'completed', updated_at = now()
  WHERE id = p_donation_id
  RETURNING * INTO v_donation;

  UPDATE public.profiles
  SET meals_received = meals_received + greatest(v_donation.meals, 1),
      updated_at = now()
  WHERE id = auth.uid();

  UPDATE public.profiles
  SET meals_helped = meals_helped + greatest(v_donation.meals, 1),
      updated_at = now()
  WHERE id = v_donation.user_id;

  RETURN v_donation;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_food_received(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_food_received(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
